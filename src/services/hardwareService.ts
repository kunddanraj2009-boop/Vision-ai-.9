import {
  HardwareState,
  SensorData,
  HostSystemMetrics,
  BrowserHardwareMetrics,
} from '../types/nancy';

type TelemetryListener = (data: SensorData) => void;
type LogListener = (log: string) => void;

class HardwareService {
  private state: HardwareState = {
    type: 'host_system',
    isConnected: false,
    deviceName: 'No External Controller Connected',
    deviceIp: '192.168.4.1',
    devicePort: 80,
    baudRate: 115200,
    isSimulated: false,
    relays: [false, false, false, false],
    ledBrightness: 0,
    servoAngle: 90,
    buzzerActive: false,
    connectionMode: 'real_hardware',
  };

  private sensorData: SensorData = {
    temperature: 0,
    humidity: 0,
    distance: 0,
    motionDetected: false,
    heartRate: 0,
    ambientLight: 0,
    voltage: 0,
    rssi: 0,
    lastUpdated: '--:--:--',
    isSimulated: false,
    dataSource: 'real_host_telemetry',
    batteryLevel: 0,
    batteryCharging: false,
    networkLatency: 0,
    controllerPackets: 0,
    controllerLatencyMs: 0,
    lastControllerRx: '',
  };

  private telemetryListeners: Set<TelemetryListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private telemetryInterval: any = null;
  private wifiPollInterval: any = null;
  private serialPort: any = null;
  private serialReader: any = null;
  private bluetoothDevice: any = null;
  private wsConnection: WebSocket | null = null;
  private realSensorsInitialized = false;
  private activeWifiEndpoint = '/sensors';
  private activeWifiProtocol: 'http' | 'https' = 'http';
  private activeWifiTransport: 'direct_http' | 'direct_ws' | 'server_proxy' | 'none' = 'none';
  private wifiConsecutiveFailures = 0;

  constructor() {
    this.detectBrowserHardware();
    this.initRealDeviceSensors();
    this.fetchRealHostTelemetry();
    this.startHostTelemetryLoop();
  }

  public isControllerConnected(): boolean {
    return (
      this.state.isConnected &&
      (this.state.type === 'esp32_wifi' ||
        this.state.type === 'serial' ||
        this.state.type === 'bluetooth')
    );
  }

  public getState(): HardwareState {
    return { ...this.state, relays: [...this.state.relays] as [boolean, boolean, boolean, boolean] };
  }

  public getSensorData(): SensorData {
    return { ...this.sensorData };
  }

  private notifyTelemetry() {
    const snapshot = this.getSensorData();
    this.telemetryListeners.forEach((cb) => cb(snapshot));
  }

  public subscribeTelemetry(listener: TelemetryListener) {
    this.telemetryListeners.add(listener);
    listener(this.getSensorData());
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public subscribeLogs(listener: LogListener) {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  public emitLog(msg: string) {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    this.logListeners.forEach((cb) => cb(formatted));
  }

  // Detect Client Browser / OS Hardware Specs via Web Standards
  private detectBrowserHardware() {
    if (typeof window === 'undefined') return;

    let gpuRenderer = 'Standard Graphics Engine';
    let gpuVendor = 'System Hardware';

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuVendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || gpuVendor;
          gpuRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
        }
      }
    } catch {}

    const browserHw: BrowserHardwareMetrics = {
      logicalCores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
      deviceMemoryGB: typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 8 : 8,
      gpuRenderer,
      gpuVendor,
      batteryLevel: this.sensorData.batteryLevel ?? 0,
      batteryCharging: this.sensorData.batteryCharging ?? false,
      networkType: typeof navigator !== 'undefined' ? (navigator as any).connection?.effectiveType || 'wifi' : 'wifi',
      downlinkMbps: typeof navigator !== 'undefined' ? (navigator as any).connection?.downlink || 10 : 10,
      rttMs: typeof navigator !== 'undefined' ? (navigator as any).connection?.rtt || 25 : 25,
    };

    this.sensorData.browserHardware = browserHw;
  }

  // Real Device Sensors (Battery, Network, Motion/Orientation)
  private async initRealDeviceSensors() {
    if (this.realSensorsInitialized || typeof window === 'undefined') return;
    this.realSensorsInitialized = true;

    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      try {
        const battery = await (navigator as any).getBattery();
        const updateBattery = () => {
          const levelPct = Math.round(battery.level * 100);
          if (this.sensorData.browserHardware) {
            this.sensorData.browserHardware.batteryLevel = levelPct;
            this.sensorData.browserHardware.batteryCharging = battery.charging;
          }
          // Only mirror host battery into main telemetry if no external controller is connected
          if (!this.isControllerConnected()) {
            this.sensorData.batteryLevel = levelPct;
            this.sensorData.batteryCharging = battery.charging;
          }
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      } catch {}
    }

    if (typeof navigator !== 'undefined' && (navigator as any).connection) {
      const conn = (navigator as any).connection;
      const updateNetwork = () => {
        if (this.sensorData.browserHardware) {
          this.sensorData.browserHardware.networkType = conn.effectiveType || 'wifi';
          this.sensorData.browserHardware.downlinkMbps = conn.downlink || 10;
          this.sensorData.browserHardware.rttMs = conn.rtt || 20;
        }
        if (!this.isControllerConnected()) {
          this.sensorData.networkLatency = conn.rtt || 20;
        }
      };
      updateNetwork();
      conn.addEventListener('change', updateNetwork);
    }
  }

  // Real Server Host Machine Hardware Fetch (for Hardware Hub diagnostics)
  public async fetchRealHostTelemetry(): Promise<HostSystemMetrics | null> {
    try {
      const res = await fetch('/api/hardware/live-telemetry');
      if (res.ok) {
        const data = await res.json();
        if (data?.telemetry) {
          const host = data.telemetry as HostSystemMetrics;
          this.sensorData.hostMetrics = host;
          if (!this.isControllerConnected()) {
            this.sensorData.dataSource = 'real_host_telemetry';
            this.notifyTelemetry();
          }
          return host;
        }
      }
    } catch {}
    return null;
  }

  private startHostTelemetryLoop() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(async () => {
      if (!this.isControllerConnected()) {
        await this.fetchRealHostTelemetry();
      }
    }, 3000);
  }

  public async refreshRealTimeSensors() {
    if (this.state.type === 'esp32_wifi' && this.state.isConnected && this.state.deviceIp) {
      this.emitLog(`Syncing live controller telemetry from ${this.state.deviceIp}:${this.state.devicePort || 80}...`);
      await this.pollWifiControllerOnce(
        this.state.deviceIp,
        this.state.devicePort || 80,
        this.activeWifiEndpoint
      );
      return this.getSensorData();
    }

    this.emitLog('Refreshing host system diagnostics...');
    await this.fetchRealHostTelemetry();
    this.notifyTelemetry();
    return this.getSensorData();
  }

  // --- Real Web Serial API (Arduino Uno / Nano / ESP32 / Pico via USB) ---
  public async connectSerial(baudRate = 115200): Promise<{ success: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !(navigator as any).serial) {
      this.emitLog('Web Serial API is not supported in this browser. Please use Google Chrome or Edge.');
      return {
        success: false,
        message: 'Web Serial not supported in this browser. Please use Chrome/Edge for USB hardware connection.',
      };
    }

    try {
      this.stopWifiPolling();
      this.emitLog('Opening native USB Serial COM Port selector...');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      this.serialPort = port;

      this.state = {
        ...this.state,
        type: 'serial',
        isConnected: true,
        deviceName: 'USB Serial Controller',
        baudRate,
        isSimulated: false,
        connectionMode: 'physical_board',
      };

      this.sensorData.dataSource = 'serial_hardware';
      this.sensorData.isSimulated = false;
      this.sensorData.controllerPackets = 0;
      this.notifyTelemetry();

      this.emitLog(`Physical USB Serial Port connected successfully at ${baudRate} baud.`);
      this.startSerialReader();

      return {
        success: true,
        message: `Connected to USB Serial controller at ${baudRate} baud.`,
      };
    } catch (err: any) {
      this.emitLog(`Serial port access error: ${err.message || err}`);
      return { success: false, message: err.message || 'Serial connection cancelled.' };
    }
  }

  private async startSerialReader() {
    if (!this.serialPort || !this.serialPort.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      this.serialPort.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      this.serialReader = reader;

      let buffer = '';
      while (this.state.isConnected && this.state.type === 'serial') {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const clean = line.trim();
            if (clean) {
              this.parsePhysicalHardwarePacket(clean);
            }
          }
        }
      }
    } catch (err: any) {
      this.emitLog(`Serial streaming halted: ${err.message}`);
    }
  }

  // Parse incoming packet from ESP32 / Arduino Controller (JSON or Key-Value format)
  private parsePhysicalHardwarePacket(raw: string, latencyMs?: number) {
    this.emitLog(`RX << ${raw}`);
    let updated = false;

    const toNum = (v: any): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const parsed = parseFloat(v);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };

    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const json = JSON.parse(raw);

        const temp = toNum(json.temp ?? json.temperature ?? json.t);
        const hum = toNum(json.hum ?? json.humidity ?? json.h);
        const dist = toNum(json.dist ?? json.distance ?? json.d);
        const light = toNum(json.light ?? json.lux ?? json.ldr);
        const voltage = toNum(json.voltage ?? json.volt ?? json.vbat ?? json.v);
        const bpm = toNum(json.bpm ?? json.heartRate ?? json.pulse);
        const rssi = toNum(json.rssi ?? json.wifiRssi ?? json.signal);
        const battery = toNum(json.battery ?? json.batteryLevel ?? json.bat);

        if (temp !== null) { this.sensorData.temperature = temp; updated = true; }
        if (hum !== null) { this.sensorData.humidity = hum; updated = true; }
        if (dist !== null) { this.sensorData.distance = dist; updated = true; }
        if (light !== null) { this.sensorData.ambientLight = light; updated = true; }
        if (voltage !== null) { this.sensorData.voltage = voltage; updated = true; }
        if (bpm !== null) { this.sensorData.heartRate = bpm; updated = true; }
        if (rssi !== null) { this.sensorData.rssi = rssi; updated = true; }
        if (battery !== null) { this.sensorData.batteryLevel = battery; updated = true; }

        if (typeof json.motion === 'boolean') {
          this.sensorData.motionDetected = json.motion;
          updated = true;
        } else if (typeof json.pir === 'boolean' || json.pir === 1 || json.pir === 0) {
          this.sensorData.motionDetected = Boolean(json.pir);
          updated = true;
        }

        if (Array.isArray(json.relays) && json.relays.length >= 4) {
          this.state.relays = [
            Boolean(json.relays[0]),
            Boolean(json.relays[1]),
            Boolean(json.relays[2]),
            Boolean(json.relays[3]),
          ];
          updated = true;
        }
        if (toNum(json.led) !== null) {
          this.state.ledBrightness = Math.max(0, Math.min(100, toNum(json.led)!));
          updated = true;
        }
        if (toNum(json.servo) !== null) {
          this.state.servoAngle = Math.max(0, Math.min(180, toNum(json.servo)!));
          updated = true;
        }

        if (updated || Object.keys(json).length > 0) {
          this.sensorData.lastUpdated = new Date().toLocaleTimeString();
          this.sensorData.lastControllerRx = raw.slice(0, 180);
          this.sensorData.controllerPackets = (this.sensorData.controllerPackets || 0) + 1;
          if (typeof latencyMs === 'number') {
            this.sensorData.controllerLatencyMs = latencyMs;
            this.sensorData.networkLatency = latencyMs;
          }
          this.notifyTelemetry();
          return;
        }
      } catch {}
    }

    // Try parsing Key-Value format: e.g. TEMP:26.5,HUM:55,DIST:40
    if (raw.includes(':') || raw.includes('=')) {
      const parts = raw.split(/[,;\s]+/);
      for (const p of parts) {
        const [k, v] = p.split(/[:=]/);
        if (!k || v === undefined) continue;
        const key = k.trim().toUpperCase();
        const num = parseFloat(v.trim());
        if (!isNaN(num)) {
          if (key.includes('TEMP')) { this.sensorData.temperature = num; updated = true; }
          if (key.includes('HUM')) { this.sensorData.humidity = num; updated = true; }
          if (key.includes('DIST')) { this.sensorData.distance = num; updated = true; }
          if (key.includes('LIGHT') || key.includes('LDR') || key.includes('LUX')) { this.sensorData.ambientLight = num; updated = true; }
          if (key.includes('VOLT')) { this.sensorData.voltage = num; updated = true; }
          if (key.includes('BPM') || key.includes('HEART')) { this.sensorData.heartRate = num; updated = true; }
          if (key.includes('RSSI')) { this.sensorData.rssi = num; updated = true; }
          if (key.includes('BAT')) { this.sensorData.batteryLevel = num; updated = true; }
          if (key.includes('MOTION') || key.includes('PIR')) { this.sensorData.motionDetected = num > 0; updated = true; }
        }
      }
      if (updated) {
        this.sensorData.lastUpdated = new Date().toLocaleTimeString();
        this.sensorData.lastControllerRx = raw.slice(0, 180);
        this.sensorData.controllerPackets = (this.sensorData.controllerPackets || 0) + 1;
        if (typeof latencyMs === 'number') {
          this.sensorData.controllerLatencyMs = latencyMs;
          this.sensorData.networkLatency = latencyMs;
        }
        this.notifyTelemetry();
      }
    }
  }

  // --- Real Web Bluetooth Connection ---
  public async connectBluetooth(): Promise<{ success: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      this.emitLog('Web Bluetooth API not supported in this browser. Please use Chrome/Edge.');
      return {
        success: false,
        message: 'Web Bluetooth API is not available in this browser. Please use Google Chrome or Edge.',
      };
    }

    try {
      this.stopWifiPolling();
      this.emitLog('Scanning for Bluetooth LE peripheral (ESP32, HM-10, Arduino BLE)...');
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service', 0xffe0],
      });

      this.bluetoothDevice = device;
      this.emitLog(`Pairing with physical Bluetooth device: ${device.name || 'Unnamed Peripheral'}...`);
      const server = await device.gatt.connect();

      this.state = {
        ...this.state,
        type: 'bluetooth',
        isConnected: server.connected,
        deviceName: device.name || 'ESP32 BLE Controller',
        isSimulated: false,
        connectionMode: 'physical_board',
      };

      this.sensorData.dataSource = 'esp32_hardware';
      this.sensorData.isSimulated = false;
      this.sensorData.controllerPackets = 0;
      this.notifyTelemetry();

      this.emitLog(`Bluetooth GATT connected to ${device.name || 'Device'}.`);
      return { success: true, message: `Connected to ${device.name || 'Device'}` };
    } catch (err: any) {
      this.emitLog(`Bluetooth connection error: ${err.message || err}`);
      return { success: false, message: err.message || 'Bluetooth connection failed.' };
    }
  }

  public isPrivateIpAddress(rawHost: string): boolean {
    const host = (rawHost || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) return false;
    if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 192 && b === 168) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 169 && b === 254) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
    }
    return host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
  }

  private normalizeIpAndPort(
    rawIp: string,
    rawPort: number
  ): { ip: string; port: number; portValid: boolean; explicitProtocol?: 'http' | 'https'; pathSuffix: string } {
    let clean = (rawIp || '').trim();
    let explicitProtocol: 'http' | 'https' | undefined;
    if (/^(https|wss):\/\//i.test(clean)) explicitProtocol = 'https';
    else if (/^(http|ws):\/\//i.test(clean)) explicitProtocol = 'http';

    clean = clean.replace(/^(https?|wss?):\/\//i, '');
    const slashIdx = clean.indexOf('/');
    const pathSuffix = slashIdx !== -1 ? clean.slice(slashIdx).replace(/\/+$/, '') : '';
    if (slashIdx !== -1) clean = clean.slice(0, slashIdx);

    let port = rawPort;
    let hasExplicitPortInUrl = false;
    if (clean.startsWith('[')) {
      const endBracket = clean.indexOf(']');
      if (endBracket === -1) {
        return { ip: '', port: 80, portValid: false, pathSuffix: '' };
      }
      const rest = clean.slice(endBracket + 1);
      clean = clean.slice(0, endBracket + 1);
      if (rest.startsWith(':')) {
        port = Number(rest.slice(1).trim());
        hasExplicitPortInUrl = true;
      } else if (rest.length > 0) {
        return { ip: '', port: 80, portValid: false, pathSuffix: '' };
      }
    } else if (clean.includes(':')) {
      const parts = clean.split(':');
      if (parts.length !== 2) {
        return { ip: '', port: 80, portValid: false, pathSuffix: '' };
      }
      clean = parts[0].trim();
      port = Number(parts[1].trim());
      hasExplicitPortInUrl = true;
    }

    if (!hasExplicitPortInUrl && explicitProtocol === 'https' && (port === 80 || !Number.isInteger(port) || isNaN(port))) {
      port = 443;
    } else if (!Number.isInteger(port) || isNaN(port)) {
      port = 80;
    }

    const portValid = Number.isInteger(port) && port >= 1 && port <= 65535;
    return { ip: clean, port: portValid ? port : 80, portValid, explicitProtocol, pathSuffix };
  }

  public isValidRealIpAddress(ip: string): boolean {
    const { ip: host, portValid } = this.normalizeIpAndPort(ip, 80);
    if (!host || !portValid) return false;
    if (host === '0.0.0.0' || host === '255.255.255.255') return false;

    const ipv4Regex =
      /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    if (ipv4Regex.test(host)) return true;

    // Also allow IPv6 in brackets [::1] or valid hostnames / DDNS / mDNS (.local)
    if (/^\[[0-9a-fA-F:]+\]$/.test(host)) return true;
    if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(host)) {
      // Reject purely numeric strings with dots that failed IPv4 octet range check (e.g. 999.999.1.1)
      if (/^\d+(\.\d+)+$/.test(host)) return false;
      return host === 'localhost' || host.includes('.');
    }
    return false;
  }

  private isValidControllerPayload(raw: string): boolean {
    const trimmed = (raw || '').trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    // Reject our own app shell if loopback happens
    if (lower.includes('use vision ai')) return false;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
      } catch {
        return false;
      }
    }

    if (trimmed.includes(':') || trimmed.includes('=')) {
      const upper = trimmed.toUpperCase();
      return ['TEMP', 'HUM', 'DIST', 'LIGHT', 'LDR', 'LUX', 'VOLT', 'BPM', 'HEART', 'RSSI', 'BAT', 'MOTION', 'PIR'].some((k) =>
        upper.includes(k)
      );
    }

    // Accept concise plain-text controller health/status payloads (non-HTML)
    if (!lower.startsWith('<!doctype') && !lower.startsWith('<html') && !lower.includes('<body') && trimmed.length <= 240) {
      return true;
    }

    return false;
  }

  private async pollWifiControllerOnce(ip: string, port: number, endpoint: string): Promise<boolean> {
    const started = performance.now();

    if (this.activeWifiTransport === 'server_proxy') {
      try {
        const res = await fetch('/api/hardware/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip,
            port,
            protocol: this.activeWifiProtocol,
            endpoint,
          }),
        });
        if (!res.ok) {
          this.wifiConsecutiveFailures += 1;
          return false;
        }
        const data = await res.json();
        if (!data?.ok) {
          this.wifiConsecutiveFailures += 1;
          return false;
        }
        const latencyMs = data.latencyMs || Math.max(1, Math.round(performance.now() - started));
        const text = String(data.rawText || '').trim();
        if (text && this.isValidControllerPayload(text)) {
          this.parsePhysicalHardwarePacket(text, latencyMs);
        }
        this.wifiConsecutiveFailures = 0;
        return true;
      } catch {
        this.wifiConsecutiveFailures += 1;
        return false;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const res = await fetch(`${this.activeWifiProtocol}://${ip}:${port}${endpoint}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.wifiConsecutiveFailures += 1;
        return false;
      }

      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      const text = (await res.text()).trim();
      if (text && this.isValidControllerPayload(text)) {
        this.parsePhysicalHardwarePacket(text, latencyMs);
      }
      this.wifiConsecutiveFailures = 0;
      return true;
    } catch {
      clearTimeout(timeoutId);
      this.wifiConsecutiveFailures += 1;
      if (this.wifiConsecutiveFailures === 6) {
        this.emitLog(`Warning: Controller at ${ip}:${port} did not respond to 6 consecutive polls.`);
      }
      return false;
    }
  }

  private startWifiPolling(
    ip: string,
    port: number,
    endpoint: string,
    protocol: 'http' | 'https' = 'http',
    transport: 'direct_http' | 'server_proxy' = 'direct_http'
  ) {
    this.stopWifiPolling();
    this.activeWifiEndpoint = endpoint;
    this.activeWifiProtocol = protocol;
    this.activeWifiTransport = transport;
    this.wifiConsecutiveFailures = 0;
    this.wifiPollInterval = setInterval(() => {
      if (this.state.isConnected && this.state.type === 'esp32_wifi') {
        void this.pollWifiControllerOnce(ip, port, endpoint);
      } else {
        this.stopWifiPolling();
      }
    }, 1500);
  }

  private stopWifiPolling() {
    if (this.wifiPollInterval) {
      clearInterval(this.wifiPollInterval);
      this.wifiPollInterval = null;
    }
  }

  private tryWebSocketUrl(
    wsUrl: string,
    timeoutMs = 2000
  ): Promise<{ ok: boolean; ws?: WebSocket; securityBlocked?: boolean }> {
    return new Promise((resolve) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err: any) {
        const isSec = err?.name === 'SecurityError' || String(err?.message || '').toLowerCase().includes('insecure');
        resolve({ ok: false, securityBlocked: isSec });
        return;
      }

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            ws.close();
          } catch {}
          resolve({ ok: false });
        }
      }, timeoutMs);

      ws.onopen = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: true, ws });
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            ws.close();
          } catch {}
          resolve({ ok: false });
        }
      };
    });
  }

  // --- Real ESP32 / Controller IP WiFi (Direct HTTP/HTTPS + WS/WSS + Cloud Server Proxy) ---
  public async connectWiFi(
    rawIp: string,
    rawPort = 80
  ): Promise<{
    success: boolean;
    message: string;
    reason?: 'invalid_ip' | 'mixed_content_lan' | 'cors_blocked' | 'connection_refused' | 'timeout' | 'unreachable_ip';
  }> {
    const { ip, port, portValid, explicitProtocol, pathSuffix } = this.normalizeIpAndPort(rawIp, rawPort);

    if (!this.isValidRealIpAddress(ip) || !portValid) {
      this.emitLog(`Rejected invalid IP/host format: "${rawIp}"`);
      return {
        success: false,
        reason: 'invalid_ip',
        message: 'Invalid IP/Port format — please enter a valid IPv4/IPv6/hostname (e.g. 192.168.1.100 or 203.0.113.10) and port 1-65535.',
      };
    }

    // Close any prior controller connections before opening new IP session
    this.stopWifiPolling();
    if (this.wsConnection) {
      try {
        this.wsConnection.close();
      } catch {}
      this.wsConnection = null;
    }

    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isPrivateIp = this.isPrivateIpAddress(ip);
    let corsSuspected = false;
    let mixedContentBlocked = false;

    this.emitLog(`Connecting to controller at ${ip}:${port}...`);

    const schemes: Array<'http' | 'https'> =
      explicitProtocol === 'https' || port === 443 || port === 8443
        ? ['https', 'http']
        : isHttpsPage
        ? ['https', 'http']
        : ['http', 'https'];

    const candidateEndpoints = Array.from(
      new Set([pathSuffix && pathSuffix !== '/' ? pathSuffix : null, '/sensors', '/data', '/status', '/api/sensors', '/'].filter(Boolean) as string[])
    );

    // 1. Try Direct Browser HTTP / HTTPS
    for (const scheme of schemes) {
      let schemeNetworkFailed = false;
      for (const endpoint of candidateEndpoints) {
        if (schemeNetworkFailed) break;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const started = performance.now();

        try {
          const res = await fetch(`${scheme}://${ip}:${port}${endpoint}`, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const latencyMs = Math.max(1, Math.round(performance.now() - started));
            const rawText = (await res.text()).trim();
            if (!this.isValidControllerPayload(rawText)) {
              continue;
            }

            this.state = {
              ...this.state,
              type: 'esp32_wifi',
              isConnected: true,
              deviceIp: ip,
              devicePort: port,
              deviceName: `ESP32 / Controller (${ip})`,
              isSimulated: false,
              connectionMode: 'physical_board',
            };
            this.sensorData.dataSource = 'esp32_hardware';
            this.sensorData.isSimulated = false;
            this.sensorData.controllerPackets = 0;
            this.sensorData.controllerLatencyMs = latencyMs;
            this.sensorData.networkLatency = latencyMs;
            this.sensorData.lastUpdated = new Date().toLocaleTimeString();

            this.parsePhysicalHardwarePacket(rawText, latencyMs);
            this.startWifiPolling(ip, port, endpoint, scheme, 'direct_http');
            this.emitLog(`Live ${scheme.toUpperCase()} stream connected to ${ip}:${port}${endpoint} (${latencyMs}ms).`);
            return {
              success: true,
              message: `Connected via ${scheme.toUpperCase()} to ${ip}:${port}${endpoint} (${latencyMs}ms).`,
            };
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          schemeNetworkFailed = true;
          const elapsed = performance.now() - started;

          // Check if browser blocked http:// from https:// page (instant failure < 350ms on HTTPS origin)
          if (scheme === 'http' && isHttpsPage && err?.name !== 'AbortError' && elapsed < 350) {
            mixedContentBlocked = true;
          } else if (err?.name !== 'AbortError') {
            // Probe with no-cors ONLY to detect whether the IP actually responded (CORS missing vs truly offline)
            try {
              const ncCtrl = new AbortController();
              const ncTimer = setTimeout(() => ncCtrl.abort(), 1200);
              await fetch(`${scheme}://${ip}:${port}${endpoint}`, {
                method: 'GET',
                mode: 'no-cors',
                signal: ncCtrl.signal,
                cache: 'no-store',
              });
              clearTimeout(ncTimer);
              corsSuspected = true;
              mixedContentBlocked = false;
            } catch {}
          }
        }
      }
    }

    // 2. Try Direct Browser WebSocket (wss:// first on HTTPS, plus ws:// for APK WebView / HTTP)
    const wsCandidates: string[] = [];
    const wsSchemes: Array<'wss' | 'ws'> =
      explicitProtocol === 'https' || port === 443 || port === 8443
        ? ['wss', 'ws']
        : isHttpsPage
        ? ['wss', 'ws']
        : ['ws', 'wss'];

    for (const wsScheme of wsSchemes) {
      wsCandidates.push(`${wsScheme}://${ip}:${port}/ws`);
      wsCandidates.push(`${wsScheme}://${ip}:${port}/`);
      if (port === 80) {
        wsCandidates.push(`${wsScheme}://${ip}:81/`);
      }
    }

    for (const wsUrl of wsCandidates) {
      const wsAttempt = await this.tryWebSocketUrl(wsUrl, 1600);
      if (wsAttempt.securityBlocked) {
        mixedContentBlocked = true;
        continue;
      }
      if (wsAttempt.ok && wsAttempt.ws) {
        const ws = wsAttempt.ws;
        this.wsConnection = ws;
        this.activeWifiTransport = 'direct_ws';
        this.activeWifiProtocol = wsUrl.startsWith('wss://') ? 'https' : 'http';

        this.state = {
          ...this.state,
          type: 'esp32_wifi',
          isConnected: true,
          deviceIp: ip,
          devicePort: port,
          deviceName: `ESP32 / Controller (${ip})`,
          isSimulated: false,
          connectionMode: 'physical_board',
        };
        this.sensorData.dataSource = 'esp32_hardware';
        this.sensorData.isSimulated = false;
        this.sensorData.controllerPackets = 0;
        this.sensorData.lastUpdated = new Date().toLocaleTimeString();

        ws.onmessage = (evt) => {
          if (typeof evt.data === 'string') {
            this.parsePhysicalHardwarePacket(evt.data);
          }
        };
        ws.onclose = () => {
          if (this.state.type === 'esp32_wifi' && this.state.isConnected && !this.wifiPollInterval) {
            this.emitLog(`WebSocket link to ${ip}:${port} closed.`);
            this.disconnect();
          }
        };

        this.notifyTelemetry();
        this.emitLog(`WebSocket live stream connected to ${wsUrl}`);
        return {
          success: true,
          message: `Connected via WebSocket to ${wsUrl}.`,
        };
      }
    }

    // 3. Fallback: Server-Side Backend Proxy (Bypasses Browser Mixed Content & CORS for Public IPs / Local Host Server)
    try {
      this.emitLog(`Probing ${ip}:${port} via backend relay...`);
      const proxyRes = await fetch('/api/hardware/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port, protocol: explicitProtocol }),
      });

      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();

        if (proxyData.success) {
          const scheme: 'http' | 'https' = proxyData.protocol === 'https' ? 'https' : 'http';
          const endpoint: string = proxyData.endpoint || '/sensors';
          const latencyMs: number = proxyData.latencyMs || 25;
          const rawText: string = String(proxyData.rawText || '').trim();

          this.state = {
            ...this.state,
            type: 'esp32_wifi',
            isConnected: true,
            deviceIp: ip,
            devicePort: port,
            deviceName: `Controller (${ip})`,
            isSimulated: false,
            connectionMode: 'physical_board',
          };
          this.sensorData.dataSource = 'esp32_hardware';
          this.sensorData.isSimulated = false;
          this.sensorData.controllerPackets = 0;
          this.sensorData.controllerLatencyMs = latencyMs;
          this.sensorData.networkLatency = latencyMs;
          this.sensorData.lastUpdated = new Date().toLocaleTimeString();

          if (rawText && this.isValidControllerPayload(rawText)) {
            this.parsePhysicalHardwarePacket(rawText, latencyMs);
          } else {
            this.notifyTelemetry();
          }

          this.startWifiPolling(ip, port, endpoint, scheme, 'server_proxy');
          this.emitLog(
            `Connected to ${ip}:${port}${endpoint} via server relay (${latencyMs}ms, HTTP ${proxyData.statusCode || 'TCP'}).`
          );

          return {
            success: true,
            message:
              proxyData.mode === 'server_proxy_tcp'
                ? `Connected to real IP ${ip}:${port} (TCP port open, ${latencyMs}ms). Waiting for sensor JSON on ${endpoint}.`
                : `Connected to ${ip}:${port}${endpoint} via server proxy (${latencyMs}ms).`,
          };
        }

        // Handle accurate failure diagnostics from backend proxy
        if (proxyData.reason === 'private_lan_from_cloud') {
          if (mixedContentBlocked || (isHttpsPage && isPrivateIp)) {
            const msg = `Browser blocked local IP ${ip}:${port} (HTTPS Mixed Content). Open Chrome Site Settings (🔒) -> "Insecure content: Allow", use the Android APK, or expose your device over HTTPS/public IP.`;
            this.emitLog(msg);
            return {
              success: false,
              reason: 'mixed_content_lan',
              message: msg,
            };
          }
        }

        if (proxyData.reason === 'connection_refused') {
          const msg = `IP ${ip} is reachable, but port ${port} refused the connection (no HTTP/WS service listening on port ${port}).`;
          this.emitLog(msg);
          return {
            success: false,
            reason: 'connection_refused',
            message: msg,
          };
        }

        if (proxyData.reason === 'timeout') {
          const msg = `Connection to ${ip}:${port} timed out (device offline, firewall blocking port ${port}, or port forwarding missing).`;
          this.emitLog(msg);
          return {
            success: false,
            reason: 'timeout',
            message: msg,
          };
        }
      }
    } catch {
      // Backend proxy unavailable
    }

    if (corsSuspected) {
      const msg = `Device at ${ip}:${port} responded, but browser CORS blocked it. Add header "Access-Control-Allow-Origin: *" on your controller or use WebSocket /ws.`;
      this.emitLog(msg);
      return {
        success: false,
        reason: 'cors_blocked',
        message: msg,
      };
    }

    if (mixedContentBlocked || (isHttpsPage && isPrivateIp)) {
      const msg = `Browser blocked local WiFi IP ${ip}:${port} from HTTPS page (Mixed Content). Allow "Insecure content" in Chrome Site Settings (🔒), use Android APK, or connect via public HTTPS tunnel.`;
      this.emitLog(msg);
      return {
        success: false,
        reason: 'mixed_content_lan',
        message: msg,
      };
    }

    const fallbackMsg = `Could not connect to ${ip}:${port} — verify device power, port ${port}, firewall, and network reachability.`;
    this.emitLog(fallbackMsg);
    return {
      success: false,
      reason: 'unreachable_ip',
      message: fallbackMsg,
    };
  }

  public disconnect() {
    this.stopWifiPolling();
    this.activeWifiTransport = 'none';

    if (this.serialPort) {
      try {
        if (this.serialReader) this.serialReader.cancel();
        this.serialPort.close();
      } catch {}
      this.serialPort = null;
      this.serialReader = null;
    }
    if (this.bluetoothDevice && this.bluetoothDevice.gatt) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch {}
      this.bluetoothDevice = null;
    }
    if (this.wsConnection) {
      try {
        this.wsConnection.close();
      } catch {}
      this.wsConnection = null;
    }

    this.state = {
      ...this.state,
      type: 'host_system',
      isConnected: false,
      deviceName: 'No External Controller Connected',
      isSimulated: false,
      relays: [false, false, false, false],
      ledBrightness: 0,
      servoAngle: 90,
      buzzerActive: false,
      connectionMode: 'real_hardware',
    };

    this.sensorData = {
      ...this.sensorData,
      temperature: 0,
      humidity: 0,
      distance: 0,
      motionDetected: false,
      heartRate: 0,
      ambientLight: 0,
      voltage: 0,
      rssi: 0,
      lastUpdated: '--:--:--',
      isSimulated: false,
      dataSource: 'real_host_telemetry',
      controllerPackets: 0,
      controllerLatencyMs: 0,
      lastControllerRx: '',
    };

    this.emitLog('Controller disconnected. Real-time data stream stopped.');
    this.notifyTelemetry();
  }

  // Actuator Controls with Real Serial, WebSocket, and Direct IP HTTP dispatch
  public async toggleRelay(relayIndex: number): Promise<boolean> {
    if (relayIndex < 0 || relayIndex > 3) return false;
    const current = this.state.relays[relayIndex];
    const updated = !current;
    const newRelays = [...this.state.relays] as [boolean, boolean, boolean, boolean];
    newRelays[relayIndex] = updated;
    this.state.relays = newRelays;
    this.notifyTelemetry();

    const cmd = `RELAY_${relayIndex + 1}_${updated ? 'ON' : 'OFF'}`;
    this.emitLog(`Relay ${relayIndex + 1} switched ${updated ? 'ON' : 'OFF'}`);
    await this.dispatchHardwareCommand(cmd, { relay: relayIndex + 1, state: updated });
    return updated;
  }

  public async setLedBrightness(brightness: number) {
    const val = Math.max(0, Math.min(100, brightness));
    this.state.ledBrightness = val;
    this.notifyTelemetry();
    this.emitLog(`LED PWM Brightness set to: ${val}%`);
    await this.dispatchHardwareCommand(`PWM_LED_${val}`, { dutyCycle: val });
  }

  public async setServoAngle(angle: number) {
    const val = Math.max(0, Math.min(180, angle));
    this.state.servoAngle = val;
    this.notifyTelemetry();
    this.emitLog(`Servo Motor Angle positioned to: ${val}°`);
    await this.dispatchHardwareCommand(`SERVO_POS_${val}`, { angle: val });
  }

  public async triggerBuzzer(durationMs = 500) {
    this.state.buzzerActive = true;
    this.notifyTelemetry();
    this.emitLog(`Hardware Piezo Buzzer triggered (${durationMs}ms)`);
    await this.dispatchHardwareCommand(`BUZZER_ON`, { durationMs });
    setTimeout(async () => {
      this.state.buzzerActive = false;
      this.notifyTelemetry();
      await this.dispatchHardwareCommand(`BUZZER_OFF`, {});
    }, durationMs);
  }

  public async sendCustomCommand(command: string) {
    this.emitLog(`TX >> ${command}`);
    await this.dispatchHardwareCommand(command, { custom: true });
  }

  // Real Hardware Dispatcher
  private async dispatchHardwareCommand(cmd: string, params: any) {
    // 1. Direct Web Serial output
    if (this.serialPort && this.serialPort.writable) {
      try {
        const textEncoder = new TextEncoder();
        const writer = this.serialPort.writable.getWriter();
        await writer.write(textEncoder.encode(cmd + '\n'));
        writer.releaseLock();
        this.emitLog(`[SERIAL TX] >> ${cmd}`);
      } catch (err: any) {
        this.emitLog(`Serial write error: ${err.message}`);
      }
    }

    // 2. Direct WebSocket output
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      try {
        this.wsConnection.send(JSON.stringify({ cmd, params, timestamp: Date.now() }));
        this.emitLog(`[WS TX] >> ${cmd}`);
        return;
      } catch {}
    }

    // 3. Direct Browser HTTP/HTTPS LAN dispatch to connected ESP32 IP
    if (
      this.state.type === 'esp32_wifi' &&
      this.state.isConnected &&
      this.state.deviceIp &&
      this.activeWifiTransport !== 'server_proxy'
    ) {
      try {
        const port = this.state.devicePort || 80;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        await fetch(`${this.activeWifiProtocol}://${this.state.deviceIp}:${port}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, params }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        this.emitLog(`[HTTP TX] >> ${cmd} -> ${this.state.deviceIp}:${port}`);
        return;
      } catch {}
    }

    // 4. Server-Side Proxy Relay
    try {
      await fetch('/api/hardware/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIp: this.state.deviceIp,
          devicePort: this.state.devicePort || 80,
          protocol: this.activeWifiProtocol,
          command: cmd,
          params,
        }),
      });
    } catch {}
  }
}

export const hardwareService = new HardwareService();
