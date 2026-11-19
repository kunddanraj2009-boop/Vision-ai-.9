export type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking' | 'alert';

export type LanguageCode = 'en' | 'hi';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source?: 'gemini' | 'local' | 'voice' | 'google_search';
  groundingSources?: Array<{ title: string; url: string }>;
}

export interface HostSystemMetrics {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePercent: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  usedMemoryMB: number;
  memoryUsagePercent: number;
  hostUptimeSeconds: number;
  processUptimeSeconds: number;
  loadAverage: number[];
  activeNetworkIP?: string;
  timestamp: string;
}

export interface BrowserHardwareMetrics {
  logicalCores: number;
  deviceMemoryGB?: number;
  gpuRenderer?: string;
  gpuVendor?: string;
  batteryLevel?: number; // 0-100%
  batteryCharging?: boolean;
  networkType?: string;
  downlinkMbps?: number;
  rttMs?: number;
}

export interface SensorData {
  temperature: number; // in Celsius
  humidity: number; // %
  distance: number; // in cm
  motionDetected: boolean;
  heartRate: number; // BPM
  ambientLight: number; // Lux
  voltage: number; // Volts
  rssi: number; // dBm
  lastUpdated: string;
  isSimulated: boolean;
  batteryLevel?: number; // 0-100%
  batteryCharging?: boolean;
  networkLatency?: number; // ms
  deviceTilt?: { alpha: number; beta: number; gamma: number };
  dataSource?: 'real_host_telemetry' | 'device_sensors' | 'esp32_hardware' | 'serial_hardware' | 'live_weather' | 'simulation';
  locationCity?: string;
  hostMetrics?: HostSystemMetrics;
  browserHardware?: BrowserHardwareMetrics;
  controllerPackets?: number;
  controllerLatencyMs?: number;
  lastControllerRx?: string;
}

export type HardwareConnectionType = 'bluetooth' | 'serial' | 'esp32_wifi' | 'host_system' | 'none';

export interface HardwareState {
  type: HardwareConnectionType;
  isConnected: boolean;
  deviceName?: string;
  deviceIp?: string;
  devicePort?: number;
  baudRate?: number;
  isSimulated: boolean;
  relays: [boolean, boolean, boolean, boolean];
  ledBrightness: number; // 0 - 100
  servoAngle: number; // 0 - 180
  buzzerActive: boolean;
  connectionMode?: 'real_hardware' | 'physical_board' | 'simulation';
}

export interface NancyAlert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  read: boolean;
  category: 'hardware' | 'sensor' | 'system' | 'vision';
}

export interface ActivityEvent {
  id: string;
  title: string;
  detail: string;
  category: 'voice' | 'hardware' | 'vision' | 'gesture' | 'ai' | 'system';
  timestamp: string;
  status?: 'success' | 'warning' | 'info';
}

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  category: 'personal' | 'hardware' | 'note' | 'task';
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

export interface FaceEnrollment {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  descriptor?: number[];
  descriptors?: number[][];
  confidenceThreshold: number;
  enrolledAt: string;
}

export type ObjectCategory =
  | 'human'
  | 'vehicle'
  | 'table_furniture'
  | 'electronics'
  | 'animal'
  | 'kitchen_food'
  | 'daily_item'
  | 'outdoor'
  | 'other';

export interface RecognizedObject {
  id: string;
  label: string;
  hindiLabel?: string;
  category?: ObjectCategory;
  categoryNameEn?: string;
  categoryNameHi?: string;
  categoryIcon?: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  estimatedDistanceMeters: number;
  rawClass?: string;
  color?: string;
}

export interface CustomKnowledge {
  id: string;
  question: string;
  answer: string;
  category: string;
  createdAt: string;
}

export type ThemeAccent = 'cyan' | 'purple' | 'emerald' | 'amber';

export interface PrivacySettings {
  saveChatHistory: boolean;
  saveVoiceActivity: boolean;
  saveVisionSnapshots: boolean;
  allowHabitLearning: boolean;
  incognitoMode: boolean;
}

export interface UserHabit {
  id: string;
  category: 'topic' | 'interaction' | 'schedule' | 'hardware' | 'vision';
  observation: string;
  confidence: number; // 0 - 1
  detectedCount: number;
  lastUpdated: string;
}

export interface UserProfile {
  id: string;
  name: string;
  callingName: string; // e.g. "Kunddan", "Boss", "Commander"
  title: string; // e.g. "Vision & Hardware Lead"
  bio: string;
  avatarIcon?: string;
  avatarUrl?: string;
  city?: string;
  preferredLanguage: LanguageCode;
  voicePitch: number;
  voiceRate: number;
  voiceVolume: number;
  selectedVoiceIndex: number;
  theme: ThemeAccent;
  communicationStyle: 'concise' | 'detailed' | 'tactical' | 'friendly';
  learnedHabits: UserHabit[];
  privacy: PrivacySettings;
  createdAt: string;
  lastActiveAt: string;
}

