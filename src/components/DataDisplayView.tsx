import React, { useState } from 'react';
import {
  Activity,
  Thermometer,
  Radio,
  RefreshCw,
  Download,
  Wifi,
  WifiOff,
  Gauge,
  Power,
  Usb,
  Bluetooth,
  Bell,
  Code2,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { HardwareState, LanguageCode, SensorData } from '../types/nancy';
import { hardwareService } from '../services/hardwareService';
import { playAudioFx } from '../services/audioSynth';
import { speechService } from '../services/speechService';

interface DataDisplayViewProps {
  sensorData: SensorData;
  hardwareState: HardwareState;
  language: LanguageCode;
  onOpenHardwareHub?: () => void;
}

export const DataDisplayView: React.FC<DataDisplayViewProps> = ({
  sensorData,
  hardwareState,
  language,
  onOpenHardwareHub,
}) => {
  const [ipInput, setIpInput] = useState(hardwareState.deviceIp || '192.168.4.1');
  const [portInput, setPortInput] = useState(String(hardwareState.devicePort || 80));
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; title?: string; text: string } | null>(null);

  const isControllerConnected =
    hardwareState.isConnected &&
    (hardwareState.type === 'esp32_wifi' ||
      hardwareState.type === 'serial' ||
      hardwareState.type === 'bluetooth');

  const handleConnectIp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsConnecting(true);
    setFeedback(null);
    playAudioFx.click();

    const trimmedIp = ipInput.trim();
    const parsedPort = parseInt(portInput, 10) || (trimmedIp.startsWith('https://') ? 443 : 80);

    if (!trimmedIp || !hardwareService.isValidRealIpAddress(trimmedIp) || isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setIsConnecting(false);
      const errText =
        language === 'hi'
          ? 'अमान्य IP या पोर्ट — कृपया सही IP एड्रेस (जैसे 192.168.1.100 या पब्लिक IP/URL) और पोर्ट (1-65535) दर्ज करें।'
          : 'Invalid IP or port — please enter a valid IPv4/IPv6/hostname (e.g. 192.168.1.100) and port (1-65535).';
      setFeedback({ ok: false, title: language === 'hi' ? 'अमान्य IP फ़ॉर्मेट' : 'Invalid IP Format', text: errText });
      void speechService.speak(
        language === 'hi'
          ? 'कृपया सही IP एड्रेस और पोर्ट दर्ज करें।'
          : 'Please enter a valid IP address and port.'
      );
      return;
    }

    const res = await hardwareService.connectWiFi(trimmedIp, parsedPort);
    setIsConnecting(false);

    if (res.success) {
      setFeedback({ ok: true, text: res.message });
      playAudioFx.acknowledge();
      void speechService.speak(
        language === 'hi'
          ? `कंट्रोलर ${trimmedIp} से सफलतापूर्वक कनेक्ट हो गया।`
          : `Controller connected at ${trimmedIp}. Live telemetry active.`
      );
    } else {
      let title = language === 'hi' ? 'कनेक्शन विफल' : 'Connection Failed';
      let errText = res.message;
      let speechMsg =
        language === 'hi'
          ? 'कनेक्ट नहीं हो सका। कृपया स्क्रीन पर कारण देखें।'
          : 'Could not connect. Check the diagnostic message on screen.';

      if (res.reason === 'mixed_content_lan') {
        title = language === 'hi'
          ? 'HTTPS ब्राउज़र ने लोकल IP ब्लॉक किया (Mixed Content)'
          : 'Blocked by HTTPS Browser (Local LAN IP)';
        errText =
          language === 'hi'
            ? `आपका IP (${trimmedIp}) सही है, लेकिन Chrome/Browser HTTPS पेज से लोकल HTTP/WS IP ब्लॉक करता है। समाधान: (1) Chrome के 🔒 आइकन → Site Settings → "Insecure content: Allow" करें, या (2) Android APK में खोलें, या (3) पब्लिक IP / HTTPS टनल इस्तेमाल करें।`
            : res.message;
        speechMsg =
          language === 'hi'
            ? 'IP सही है, लेकिन ब्राउज़र ने लोकल नेटवर्क कनेक्शन को ब्लॉक किया है।'
            : 'IP is valid, but browser blocked local HTTP from HTTPS.';
      } else if (res.reason === 'cors_blocked') {
        title = language === 'hi' ? 'CORS हेडर मिसिंग (Device Reachable)' : 'CORS Blocked by Device';
        errText =
          language === 'hi'
            ? `डिवाइस ${trimmedIp}:${parsedPort} पर मिल गया है, लेकिन ESP32 कोड में "Access-Control-Allow-Origin: *" हेडर नहीं है।`
            : res.message;
      } else if (res.reason === 'connection_refused') {
        title = language === 'hi' ? 'पोर्ट बंद है (Connection Refused)' : 'Port Closed / Connection Refused';
        errText =
          language === 'hi'
            ? `IP (${trimmedIp}) चालू है, लेकिन पोर्ट ${parsedPort} पर कोई सर्वर/सेवा चालू नहीं है। पोर्ट नंबर जाँचें।`
            : res.message;
      } else if (res.reason === 'timeout' || res.reason === 'unreachable_ip') {
        title = language === 'hi' ? 'डिवाइस ऑफ़लाइन / पहुँच से बाहर' : 'Device Unreachable / Timed Out';
        errText =
          language === 'hi'
            ? `${trimmedIp}:${parsedPort} से जवाब नहीं मिला — डिवाइस पावर, पोर्ट फ़ॉरवर्डिंग, फ़ायरवॉल या वाई-फ़ाई नेटवर्क जाँचें।`
            : res.message;
      }

      setFeedback({ ok: false, title, text: errText });
      void speechService.speak(speechMsg);
    }
  };

  const handleConnectSerial = async () => {
    setIsConnecting(true);
    setFeedback(null);
    playAudioFx.click();
    const res = await hardwareService.connectSerial(115200);
    setIsConnecting(false);
    setFeedback({ ok: res.success, text: res.message });
    if (res.success) playAudioFx.acknowledge();
  };

  const handleConnectBle = async () => {
    setIsConnecting(true);
    setFeedback(null);
    playAudioFx.click();
    const res = await hardwareService.connectBluetooth();
    setIsConnecting(false);
    setFeedback({ ok: res.success, text: res.message });
    if (res.success) playAudioFx.acknowledge();
  };

  const handleDisconnect = () => {
    playAudioFx.click();
    hardwareService.disconnect();
    setFeedback(null);
  };

  const handleRefresh = async () => {
    setIsSyncing(true);
    playAudioFx.click();
    try {
      await hardwareService.refreshRealTimeSensors();
      playAudioFx.acknowledge();
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  const handleExportSnapshot = () => {
    playAudioFx.click();
    const payload = {
      exportedAt: new Date().toISOString(),
      hardwareState,
      sensorData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controller_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // GATE: Show real-time data ONLY when ESP32 or a controller is connected
  if (!isControllerConnected) {
    return (
      <div className="flex flex-col max-w-xl mx-auto w-full px-3 pb-24 pt-2 space-y-3.5 select-none">
        {/* Header */}
        <div className="flex items-center justify-between py-2 border-b border-slate-800 px-1">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="font-cyber font-bold text-xs text-slate-200">
              {language === 'hi' ? 'रियल-टाइम डेटा डिस्प्ले' : 'REAL-TIME DATA DISPLAY'}
            </span>
          </div>
          <span className="text-[9px] font-mono-cyber px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700 flex items-center space-x-1">
            <WifiOff className="w-3 h-3 text-slate-500" />
            <span>{language === 'hi' ? 'ऑफ़लाइन' : 'NOT CONNECTED'}</span>
          </span>
        </div>

        {/* IP Connection Required Card */}
        <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-500/30 space-y-3.5 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/30 shrink-0">
              <Wifi className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="space-y-1">
              <h2 className="font-cyber font-bold text-sm text-cyan-300">
                {language === 'hi'
                  ? 'ESP32 / कंट्रोलर को रियल IP एड्रेस से कनेक्ट करें'
                  : 'CONNECT ESP32 / CONTROLLER VIA REAL IP'}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {language === 'hi'
                  ? 'रियल-टाइम सेंसर डेटा तभी दिखेगा जब आप अपने ESP32 या किसी हार्डवेयर कंट्रोलर को असली IP एड्रेस से कनेक्ट करेंगे।'
                  : 'Real-time sensor data is only displayed when connected to a real ESP32 or controller IP address.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleConnectIp} noValidate className="space-y-2.5 pt-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-mono-cyber text-slate-400 block mb-1">
                  {language === 'hi' ? 'रियल IP एड्रेस' : 'REAL IP ADDRESS'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ipInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIpInput(val);
                    if (/^(https|wss):\/\//i.test(val.trim()) && portInput === '80') {
                      setPortInput('443');
                    } else if (/^(http|ws):\/\//i.test(val.trim()) && portInput === '443') {
                      setPortInput('80');
                    }
                    if (feedback && !feedback.ok) setFeedback(null);
                  }}
                  placeholder="192.168.4.1"
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-slate-100 font-mono-cyber text-xs focus:outline-none ${
                    feedback && !feedback.ok
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-700 focus:border-cyan-400'
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono-cyber text-slate-400 block mb-1">
                  PORT
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  placeholder="80"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono-cyber text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isConnecting}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-cyber font-bold text-xs tracking-wider transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
            >
              <Wifi className={`w-4 h-4 ${isConnecting ? 'animate-pulse' : ''}`} />
              <span>
                {isConnecting
                  ? language === 'hi'
                    ? 'IP सत्यापित और कनेक्ट हो रहा है...'
                    : 'VERIFYING & CONNECTING IP...'
                  : language === 'hi'
                  ? 'रियल IP एड्रेस से कनेक्ट करें'
                  : 'CONNECT REAL IP CONTROLLER'}
              </span>
            </button>
          </form>

          {feedback && (
            <div
              className={`p-3 rounded-xl border text-[11px] font-mono-cyber flex items-start space-x-2 ${
                feedback.ok
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
              }`}
            >
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${feedback.ok ? 'text-emerald-400' : 'text-rose-400'}`} />
              <div className="space-y-0.5">
                {feedback.title && (
                  <div className="font-bold text-xs text-rose-300 uppercase tracking-wide">
                    {feedback.title}
                  </div>
                )}
                <div>{feedback.text}</div>
              </div>
            </div>
          )}

          {/* Secondary direct controller options */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-[10px] font-mono-cyber text-slate-400 block">
              {language === 'hi' ? 'अन्य फिजिकल कंट्रोलर विकल्प:' : 'OTHER HARDWARE LINKS:'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleConnectSerial}
                disabled={isConnecting}
                className="py-2 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono-cyber flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Usb className="w-3.5 h-3.5 text-cyan-400" />
                <span>USB SERIAL</span>
              </button>
              <button
                type="button"
                onClick={handleConnectBle}
                disabled={isConnecting}
                className="py-2 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono-cyber flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                <span>BLUETOOTH</span>
              </button>
              {onOpenHardwareHub && (
                <button
                  type="button"
                  onClick={() => {
                    playAudioFx.click();
                    onOpenHardwareHub();
                  }}
                  className="col-span-2 sm:col-span-1 py-2 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono-cyber flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ESP32 CODE</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Supported Endpoint Format Info */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono-cyber text-slate-400 space-y-1.5">
          <div className="text-slate-300 font-bold">
            {language === 'hi' ? 'ESP32 / कंट्रोलर डेटा फॉर्मेट:' : 'SUPPORTED CONTROLLER ENDPOINTS:'}
          </div>
          <div>• HTTP JSON: <span className="text-cyan-300">GET http://&lt;IP&gt;:&lt;PORT&gt;/sensors</span></div>
          <div>• WebSocket: <span className="text-cyan-300">ws://&lt;IP&gt;:&lt;PORT&gt;/ws</span></div>
          <div className="pt-1 text-slate-500 break-all">
            JSON: {'{"temp":26.4,"hum":54,"dist":32,"light":410,"voltage":3.85,"bpm":74,"motion":false}'}
          </div>
        </div>
      </div>
    );
  }

  const connectionBadgeLabel =
    hardwareState.type === 'esp32_wifi'
      ? `IP ${hardwareState.deviceIp}:${hardwareState.devicePort || 80}`
      : hardwareState.type === 'serial'
      ? `USB SERIAL (${hardwareState.baudRate || 115200})`
      : 'BLUETOOTH BLE';

  return (
    <div className="flex flex-col max-w-xl mx-auto w-full px-3 pb-24 pt-1 space-y-3 select-none">
      {/* Top Action Header */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800 px-1">
        <div className="flex items-center space-x-2 min-w-0">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-cyber font-bold text-xs text-slate-200 truncate">
            {language === 'hi' ? 'लाइव कंट्रोलर डेटा' : 'LIVE CONTROLLER DATA'}
          </span>
          <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>LIVE</span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isSyncing}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors cursor-pointer"
            title="Poll Connected Controller Now"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{language === 'hi' ? 'सिंक' : 'SYNC'}</span>
          </button>
          <button
            onClick={handleExportSnapshot}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
            title="Export Telemetry Snapshot (JSON)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDisconnect}
            className="px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors cursor-pointer"
            title="Disconnect Controller"
          >
            <Power className="w-3 h-3" />
            <span>{language === 'hi' ? 'बंद' : 'DISCONNECT'}</span>
          </button>
        </div>
      </div>

      {/* Connected Controller Status Ribbon */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/85 border border-emerald-500/30 text-[10px] font-mono-cyber">
        <div className="flex items-center space-x-2 min-w-0">
          <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
          <span className="text-emerald-300 font-bold truncate">
            {hardwareState.deviceName} • {connectionBadgeLabel}
          </span>
        </div>
        <span className="text-slate-400 shrink-0 ml-2">
          PKT #{sensorData.controllerPackets ?? 0} • {sensorData.lastUpdated}
        </span>
      </div>

      {/* 6 Quick Controller KPI Metrics Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] font-mono-cyber">
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[9px] text-slate-400 block">TEMP</span>
          <span className="text-cyan-300 font-bold text-xs">{sensorData.temperature}°C</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[9px] text-slate-400 block">HUMIDITY</span>
          <span className="text-sky-300 font-bold text-xs">{sensorData.humidity}%</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[9px] text-slate-400 block">DISTANCE</span>
          <span className="text-emerald-300 font-bold text-xs">{sensorData.distance} cm</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[9px] text-slate-400 block">LIGHT</span>
          <span className="text-amber-300 font-bold text-xs">{sensorData.ambientLight} lx</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[9px] text-slate-400 block">VOLTAGE</span>
          <span className="text-purple-300 font-bold text-xs">{sensorData.voltage}V</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[9px] text-slate-400 block">PULSE</span>
          <span className="text-rose-300 font-bold text-xs">{sensorData.heartRate} BPM</span>
        </div>
      </div>

      {/* Detailed Live Controller Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] font-mono-cyber">
        {/* 1. Controller Sensor Channels */}
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-cyan-500/25 space-y-2">
          <div className="flex items-center space-x-1.5 text-cyan-300 font-bold text-[10px] border-b border-slate-800 pb-1.5">
            <Thermometer className="w-3.5 h-3.5" />
            <span>CONTROLLER SENSORS</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between text-slate-300">
              <span>Temperature / Humidity:</span>
              <span className="text-cyan-300 font-semibold">
                {sensorData.temperature}°C • {sensorData.humidity}% RH
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Ultrasonic Distance:</span>
              <span className="text-emerald-300 font-semibold">{sensorData.distance} cm</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Ambient Light (LDR):</span>
              <span className="text-amber-300 font-semibold">{sensorData.ambientLight} Lux</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>PIR Motion / Pulse:</span>
              <span className={sensorData.motionDetected ? 'text-amber-300 font-bold' : 'text-emerald-300'}>
                {sensorData.motionDetected ? 'MOTION' : 'CLEAR'} • {sensorData.heartRate} BPM
              </span>
            </div>
          </div>
        </div>

        {/* 2. Controller Link & Power */}
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-emerald-500/25 space-y-2">
          <div className="flex items-center space-x-1.5 text-emerald-300 font-bold text-[10px] border-b border-slate-800 pb-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>LINK & POWER METRICS</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between text-slate-300">
              <span>Endpoint:</span>
              <span className="text-cyan-300 font-semibold truncate ml-2">{connectionBadgeLabel}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Voltage / Battery:</span>
              <span className="text-amber-300 font-semibold">
                {sensorData.voltage}V • {sensorData.batteryLevel ?? 0}%
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Signal RSSI / Latency:</span>
              <span className="text-teal-300 font-semibold">
                {sensorData.rssi} dBm • {sensorData.controllerLatencyMs ?? sensorData.networkLatency ?? 0}ms
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Packets Received:</span>
              <span className="text-slate-200 font-semibold">{sensorData.controllerPackets ?? 0}</span>
            </div>
          </div>
        </div>

        {/* 3. Actuators & Relay Controls */}
        <div className="sm:col-span-2 p-3 rounded-2xl bg-slate-900/80 border border-sky-500/25 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="flex items-center space-x-1.5 text-sky-300 font-bold text-[10px]">
              <Gauge className="w-3.5 h-3.5" />
              <span>ACTUATORS & RELAY OUTPUTS</span>
            </span>
            <button
              onClick={() => {
                playAudioFx.alertSiren();
                hardwareService.triggerBuzzer(500);
              }}
              className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[9px] flex items-center space-x-1 cursor-pointer"
            >
              <Bell className="w-3 h-3" />
              <span>{hardwareState.buzzerActive ? 'BUZZING' : 'BUZZER'}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {hardwareState.relays.map((isOn, idx) => (
              <button
                key={idx}
                onClick={() => {
                  playAudioFx.click();
                  hardwareService.toggleRelay(idx);
                }}
                className={`py-2 rounded-lg border text-[10px] font-bold transition-colors cursor-pointer ${
                  isOn
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                R{idx + 1}: {isOn ? 'ON' : 'OFF'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>PWM LED</span>
                <span className="text-cyan-300 font-bold">{hardwareState.ledBrightness}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hardwareState.ledBrightness}
                onChange={(e) => hardwareService.setLedBrightness(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Servo Angle</span>
                <span className="text-sky-300 font-bold">{hardwareState.servoAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                value={hardwareState.servoAngle}
                onChange={(e) => hardwareService.setServoAngle(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Latest Raw Controller Packet */}
      {sensorData.lastControllerRx && (
        <div className="px-3 py-2 rounded-xl bg-black/70 border border-slate-800 text-[10px] font-mono-cyber text-cyan-300 truncate">
          <span className="text-slate-500 mr-1.5">RX:</span>
          {sensorData.lastControllerRx}
        </div>
      )}
    </div>
  );
};
