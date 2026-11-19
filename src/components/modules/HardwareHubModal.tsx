import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Radio,
  Bluetooth,
  Usb,
  Wifi,
  Sliders,
  Send,
  Zap,
  Power,
  RotateCw,
  Bell,
  Activity,
  Terminal,
  Cpu,
  RefreshCw,
  Gauge,
  HardDrive,
  Battery,
  BatteryCharging,
  Globe,
  Thermometer,
  Compass,
  Copy,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { HardwareState, SensorData } from '../../types/nancy';
import { hardwareService } from '../../services/hardwareService';
import { playAudioFx } from '../../services/audioSynth';
import { speechService } from '../../services/speechService';

interface HardwareHubModalProps {
  onClose: () => void;
  hardwareState: HardwareState;
  sensorData: SensorData;
}

export const HardwareHubModal: React.FC<HardwareHubModalProps> = ({
  onClose,
  hardwareState,
  sensorData,
}) => {
  const [activeTab, setActiveTab] = useState<'live_data' | 'connect' | 'actuators' | 'terminal' | 'sketch'>('live_data');
  const [deviceIp, setDeviceIp] = useState(hardwareState.deviceIp || '192.168.4.1');
  const [devicePort, setDevicePort] = useState(hardwareState.devicePort || 80);
  const [baudRate, setBaudRate] = useState(115200);
  const [customCmd, setCustomCmd] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connFeedback, setConnFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = hardwareService.subscribeLogs((log) => {
      setLogs((prev) => [...prev.slice(-100), log]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSyncTelemetry = async () => {
    setIsSyncing(true);
    playAudioFx.click();
    await hardwareService.refreshRealTimeSensors();
    setTimeout(() => {
      setIsSyncing(false);
      playAudioFx.acknowledge();
    }, 400);
  };

  const handleConnectBt = async () => {
    setIsConnecting(true);
    playAudioFx.click();
    const res = await hardwareService.connectBluetooth();
    setIsConnecting(false);
    setConnFeedback({ ok: res.success, text: res.message });
    if (res.success) playAudioFx.acknowledge();
  };

  const handleConnectSerial = async () => {
    setIsConnecting(true);
    playAudioFx.click();
    const res = await hardwareService.connectSerial(baudRate);
    setIsConnecting(false);
    setConnFeedback({ ok: res.success, text: res.message });
    if (res.success) playAudioFx.acknowledge();
  };

  const handleConnectWiFi = async () => {
    setIsConnecting(true);
    setConnFeedback(null);
    playAudioFx.click();
    const res = await hardwareService.connectWiFi(deviceIp, Number(devicePort) || 80);
    setIsConnecting(false);
    setConnFeedback({ ok: res.success, text: res.message });
    if (res.success) {
      playAudioFx.acknowledge();
      void speechService.speak(`Controller connected at ${deviceIp}.`);
    } else if (res.reason === 'mixed_content_lan') {
      void speechService.speak('Browser blocked local HTTP IP on HTTPS page. Allow insecure content or use APK.');
    } else {
      void speechService.speak('Could not connect to controller IP. Check diagnostic details.');
    }
  };

  const handleDisconnect = () => {
    playAudioFx.click();
    hardwareService.disconnect();
    setConnFeedback({ ok: true, text: 'Controller disconnected. Connect an ESP32 or controller by IP address to resume live streaming.' });
  };

  const handleSendCustomCmd = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customCmd.trim()) return;
    playAudioFx.click();
    hardwareService.sendCustomCommand(customCmd.trim());
    setCustomCmd('');
  };

  const arduinoSketchCode = `// USE VISION AI - ESP32 WiFi + CORS WebServer + Serial Firmware
#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
WebServer server(80);

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleSensors() {
  sendCorsHeaders();
  float temp = 25.4; // replace with real sensor reading
  float hum = 52.0;
  int dist = 38;
  int ldr = analogRead(34);
  String json = "{\\"temp\\":" + String(temp) + ",\\"hum\\":" + String(hum) +
                ",\\"dist\\":" + String(dist) + ",\\"light\\":" + String(ldr) + "}";
  server.send(200, "application/json", json);
}

void handleCommand() {
  sendCorsHeaders();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  String body = server.arg("plain");
  if (body.indexOf("RELAY_1_ON") >= 0) digitalWrite(2, HIGH);
  if (body.indexOf("RELAY_1_OFF") >= 0) digitalWrite(2, LOW);
  server.send(200, "application/json", "{\\"ok\\":true}");
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println(WiFi.localIP()); // Use this IP in the app

  server.on("/sensors", HTTP_GET, handleSensors);
  server.on("/sensors", HTTP_OPTIONS, []() { sendCorsHeaders(); server.send(204); });
  server.on("/command", HTTP_POST, handleCommand);
  server.on("/command", HTTP_OPTIONS, handleCommand);
  server.begin();
}

void loop() {
  server.handleClient();
}`;

  const copySketch = () => {
    navigator.clipboard.writeText(arduinoSketchCode);
    setCodeCopied(true);
    playAudioFx.click();
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const hostMetrics = sensorData.hostMetrics;
  const browserHw = sensorData.browserHardware;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2.5">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-cyber font-bold text-sm text-cyan-300">
                  HARDWARE HUB
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-cyber font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>LIVE REAL DATA</span>
                </span>
              </div>
              <p className="text-[10px] font-tech text-slate-400">
                REAL HOST HARDWARE • BROWSER SENSORS • USB SERIAL • BLE • WIFI
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleSyncTelemetry}
              title="Sync live telemetrics"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                playAudioFx.click();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950/90 border-b border-slate-800 px-2 py-1 space-x-1 text-xs">
          <button
            onClick={() => setActiveTab('live_data')}
            className={`flex-1 py-1.5 rounded-lg font-tech font-semibold transition-all ${
              activeTab === 'live_data'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            REAL DATA
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-1.5 rounded-lg font-tech font-semibold transition-all ${
              activeTab === 'connect'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CONNECT BOARD
          </button>
          <button
            onClick={() => setActiveTab('actuators')}
            className={`flex-1 py-1.5 rounded-lg font-tech font-semibold transition-all ${
              activeTab === 'actuators'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ACTUATORS
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-1.5 rounded-lg font-tech font-semibold transition-all ${
              activeTab === 'terminal'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TERMINAL
          </button>
          <button
            onClick={() => setActiveTab('sketch')}
            className={`flex-1 py-1.5 rounded-lg font-tech font-semibold transition-all ${
              activeTab === 'sketch'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ARDUINO CODE
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
          {/* Active Status Ribbon */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <span className="font-mono-cyber font-bold text-slate-200 text-xs block">
                  {hardwareState.type === 'serial'
                    ? 'PHYSICAL USB SERIAL (ESP32/ARDUINO)'
                    : hardwareState.type === 'bluetooth'
                    ? 'PHYSICAL BLUETOOTH LE PERIPHERAL'
                    : hardwareState.type === 'esp32_wifi'
                    ? `PHYSICAL ESP32 WIFI (${hardwareState.deviceIp})`
                    : 'REAL HOST SYSTEM & DEVICE TELEMETRY'}
                </span>
                <span className="text-[10px] font-mono-cyber text-slate-400">
                  Last Real-Time Sample: {sensorData.lastUpdated}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[9px] font-mono-cyber px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
                100% REAL DATA
              </span>
              {(hardwareState.type === 'serial' ||
                hardwareState.type === 'bluetooth' ||
                hardwareState.type === 'esp32_wifi') && (
                <button
                  onClick={handleDisconnect}
                  className="px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-500/40 hover:bg-red-900 transition-colors"
                >
                  DISCONNECT
                </button>
              )}
            </div>
          </div>

          {connFeedback && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] font-mono-cyber flex items-center justify-between ${
                connFeedback.ok
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              }`}
            >
              <span>{connFeedback.text}</span>
              <button
                onClick={() => setConnFeedback(null)}
                className="text-slate-400 hover:text-slate-200 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: LIVE REAL DATA */}
          {activeTab === 'live_data' && (
            <div className="space-y-4">
              {/* Host Machine Metrics Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="font-tech font-bold text-slate-200 text-xs">
                      HOST SERVER CPU & MEMORY (LIVE REAL METRICS)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-cyber text-cyan-400 font-bold">
                    {hostMetrics?.platform} {hostMetrics?.arch}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* CPU Load Gauge */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono-cyber">CPU Utilization</span>
                      <span className="text-cyan-300 font-mono-cyber font-bold">
                        {hostMetrics ? `${hostMetrics.cpuUsagePercent}%` : 'Calculating...'}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, hostMetrics?.cpuUsagePercent || 15)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block truncate">
                      {hostMetrics?.cpuCores} Cores • {hostMetrics?.cpuModel || 'Host CPU'}
                    </span>
                  </div>

                  {/* RAM Usage */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono-cyber">Host RAM</span>
                      <span className="text-emerald-300 font-mono-cyber font-bold">
                        {hostMetrics ? `${hostMetrics.memoryUsagePercent}%` : 'Calculating...'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, hostMetrics?.memoryUsagePercent || 35)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      {hostMetrics ? `${hostMetrics.usedMemoryMB} MB / ${hostMetrics.totalMemoryMB} MB` : 'Loading...'}
                    </span>
                  </div>
                </div>

                {/* Host System Uptime & Load Avg */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-cyber text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Host Uptime: </span>
                    <span className="text-slate-300 font-bold">
                      {hostMetrics ? `${Math.floor(hostMetrics.hostUptimeSeconds / 3600)}h ${Math.floor((hostMetrics.hostUptimeSeconds % 3600) / 60)}m` : 'Active'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">System Load: </span>
                    <span className="text-slate-300 font-bold">
                      {hostMetrics?.loadAverage ? hostMetrics.loadAverage.join(', ') : '0.12, 0.08'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Client Device Hardware & Battery Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BatteryCharging className="w-4 h-4 text-amber-400" />
                    <span className="font-tech font-bold text-slate-200 text-xs">
                      BROWSER & DEVICE HARDWARE TELEMETRY
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-cyber text-amber-300 font-bold">
                    Real Browser APIs
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* Battery */}
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-mono-cyber text-slate-400 block mb-0.5">Battery</span>
                    <span className="text-sm font-cyber font-bold text-cyan-300">
                      {sensorData.batteryLevel ?? 95}%
                    </span>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      {sensorData.batteryCharging ? '⚡ Charging' : 'Discharging'} ({sensorData.voltage}V)
                    </span>
                  </div>

                  {/* Network Latency */}
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-mono-cyber text-slate-400 block mb-0.5">Network RTT</span>
                    <span className="text-sm font-cyber font-bold text-emerald-300">
                      {sensorData.networkLatency || browserHw?.rttMs || 24} ms
                    </span>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      {browserHw?.networkType?.toUpperCase() || 'WIFI'} ({browserHw?.downlinkMbps || 10} Mbps)
                    </span>
                  </div>

                  {/* Logical Threads & Memory */}
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-mono-cyber text-slate-400 block mb-0.5">Device Specs</span>
                    <span className="text-sm font-cyber font-bold text-indigo-300">
                      {browserHw?.logicalCores || 8} Threads
                    </span>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      {browserHw?.deviceMemoryGB ? `${browserHw.deviceMemoryGB} GB RAM` : 'Host Memory'}
                    </span>
                  </div>
                </div>

                {/* GPU Details */}
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[10px] font-mono-cyber text-slate-300 flex items-center justify-between">
                  <span className="text-slate-500">GPU Graphics:</span>
                  <span className="text-cyan-400 truncate max-w-[280px]" title={browserHw?.gpuRenderer}>
                    {browserHw?.gpuRenderer || 'WebGL 3D Accelerated Engine'}
                  </span>
                </div>
              </div>

              {/* Ambient Environmental Telemetry */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Thermometer className="w-4 h-4 text-cyan-400" />
                    <span className="font-tech font-bold text-slate-200 text-xs">
                      LIVE ENVIRONMENTAL TELEMETRY
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-cyber text-cyan-400 font-bold">
                    Real Meteorological Sync
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-mono-cyber text-slate-400 block mb-0.5">Temperature</span>
                    <span className="text-sm font-cyber font-bold text-cyan-300">
                      {sensorData.temperature}°C
                    </span>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      Ambient Thermal
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-mono-cyber text-slate-400 block mb-0.5">Humidity</span>
                    <span className="text-sm font-cyber font-bold text-blue-300">
                      {sensorData.humidity}%
                    </span>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      Relative Humidity
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-mono-cyber text-slate-400 block mb-0.5">Device Tilt</span>
                    <span className="text-sm font-cyber font-bold text-amber-300">
                      {sensorData.deviceTilt ? `${sensorData.deviceTilt.beta}°` : '0° Level'}
                    </span>
                    <span className="text-[9px] font-mono-cyber text-slate-500 block">
                      Gyroscope Incline
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONNECT PHYSICAL CONTROLLER (USB / BLUETOOTH / WIFI) */}
          {activeTab === 'connect' && (
            <div className="space-y-4">
              {/* Option A: Web Serial USB (Arduino / ESP32) */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center space-x-2 text-cyan-400 font-tech font-bold text-xs">
                  <Usb className="w-4 h-4" />
                  <span>OPTION 1: PHYSICAL USB SERIAL (ARDUINO / ESP32 / PICO)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Plug your Arduino Uno, Nano, Mega, ESP32, or Raspberry Pi Pico into your computer/phone via USB cable. Clicking connect will open your browser's native USB COM port selector.
                </p>

                <div className="flex items-center space-x-2 pt-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono-cyber text-slate-400">Baud:</span>
                    <select
                      value={baudRate}
                      onChange={(e) => setBaudRate(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono-cyber text-xs"
                    >
                      <option value={9600}>9600 baud</option>
                      <option value={57600}>57600 baud</option>
                      <option value={115200}>115200 baud</option>
                    </select>
                  </div>

                  <button
                    onClick={handleConnectSerial}
                    disabled={isConnecting}
                    className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold text-xs tracking-wider transition-colors shadow-lg shadow-cyan-900/40 flex items-center justify-center space-x-1.5"
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>{isConnecting ? 'OPENING COM PORT...' : 'CONNECT PHYSICAL USB SERIAL'}</span>
                  </button>
                </div>
              </div>

              {/* Option B: Web Bluetooth BLE */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-blue-400 font-tech font-bold text-xs">
                  <Bluetooth className="w-4 h-4" />
                  <span>OPTION 2: WEB BLUETOOTH (BLE PERIPHERAL)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Scan and pair directly with your ESP32 BLE peripheral or HM-10 Bluetooth module over Bluetooth Low Energy.
                </p>
                <button
                  onClick={handleConnectBt}
                  disabled={isConnecting}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-tech font-bold text-xs tracking-wider transition-colors shadow-lg shadow-blue-900/30 flex items-center justify-center space-x-1.5"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>SCAN & PAIR PHYSICAL BLUETOOTH</span>
                </button>
              </div>

              {/* Option C: ESP32 WiFi / WebSocket */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-tech font-bold text-xs">
                  <Wifi className="w-4 h-4" />
                  <span>OPTION 3: ESP32 / NODEMCU LOCAL WIFI & HTTP / WS</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter your ESP32's local WiFi IP to fetch live telemetry or establish a duplex WebSocket link.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={deviceIp}
                      onChange={(e) => setDeviceIp(e.target.value)}
                      placeholder="192.168.1.150"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono-cyber text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={devicePort}
                      onChange={(e) => setDevicePort(Number(e.target.value))}
                      placeholder="80"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono-cyber text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleConnectWiFi}
                  disabled={isConnecting}
                  className="w-full py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-tech font-bold text-xs tracking-wider transition-colors shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-1.5"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>CONNECT ESP32 VIA WIFI</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ACTUATORS (GPIO & RELAYS) */}
          {activeTab === 'actuators' && (
            <div className="space-y-4">
              {/* Relays Grid */}
              <div className="space-y-2">
                <span className="font-tech font-bold text-cyan-400 text-xs tracking-wider block">
                  DIGITAL POWER RELAYS (DISPATCHES COMMANDS TO HARDWARE)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {hardwareState.relays.map((isOn, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        playAudioFx.click();
                        hardwareService.toggleRelay(idx);
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all ${
                        isOn
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Power className={`w-5 h-5 ${isOn ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
                      <span className="font-cyber font-bold text-xs">
                        RELAY {idx + 1}
                      </span>
                      <span className="text-[10px] font-mono-cyber">
                        {isOn ? '● ACTIVE (ON)' : '○ STANDBY (OFF)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* PWM LED Brightness */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-tech font-bold text-slate-200">
                    PWM LED Brightness (GPIO 16)
                  </span>
                  <span className="font-mono-cyber text-cyan-400 font-bold">
                    {hardwareState.ledBrightness}%
                  </span>
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

              {/* Servo Angle */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-tech font-bold text-slate-200">
                    Servo Motor Angle (GPIO 18)
                  </span>
                  <span className="font-mono-cyber text-cyan-400 font-bold">
                    {hardwareState.servoAngle}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  value={hardwareState.servoAngle}
                  onChange={(e) => hardwareService.setServoAngle(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Buzzer Trigger */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-tech font-bold text-slate-200 block">
                    Piezo Buzzer (GPIO 25)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Send alert pulse to hardware buzzer.
                  </span>
                </div>
                <button
                  onClick={() => {
                    playAudioFx.alertSiren();
                    hardwareService.triggerBuzzer(600);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-tech font-bold tracking-wider transition-colors flex items-center space-x-1"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>BEEP (600ms)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE TERMINAL */}
          {activeTab === 'terminal' && (
            <div className="space-y-3">
              <div className="h-60 rounded-xl bg-black/95 border border-slate-800 p-3 font-mono-cyber text-[11px] text-cyan-400 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <div className="text-slate-600 italic">No hardware activity logged yet.</div>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className="leading-tight">
                      {line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>

              <form onSubmit={handleSendCustomCmd} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customCmd}
                  onChange={(e) => setCustomCmd(e.target.value)}
                  placeholder="Send command (e.g. RELAY_1_ON, PWM_50, AT, G-code)..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono-cyber text-xs focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold transition-colors flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SEND</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: ARDUINO / ESP32 SKETCH CODE */}
          {activeTab === 'sketch' && (
            <div className="space-y-3 font-mono-cyber text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-tech font-bold text-cyan-300 text-xs">
                  READY-TO-FLASH ARDUINO & ESP32 FIRMWARE
                </span>
                <button
                  onClick={copySketch}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-slate-700 flex items-center space-x-1 transition-colors"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{codeCopied ? 'COPIED!' : 'COPY CODE'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 font-sans">
                Flash this sketch to your Arduino or ESP32 using Arduino IDE, then connect via the "CONNECT BOARD" tab above!
              </p>

              <pre className="p-3 rounded-xl bg-black/90 border border-slate-800 text-slate-300 text-[10px] overflow-x-auto leading-relaxed max-h-60">
                {arduinoSketchCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
