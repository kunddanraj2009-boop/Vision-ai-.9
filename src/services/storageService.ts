import {
  ActivityEvent,
  CustomKnowledge,
  FaceEnrollment,
  LanguageCode,
  MemoryItem,
  NancyAlert,
  UserProfile,
  UserHabit,
  ThemeAccent,
} from '../types/nancy';

const KEYS = {
  MEMORIES: 'nancy_memories_v1',
  FACES: 'nancy_faces_v1',
  KNOWLEDGE: 'nancy_knowledge_v1',
  ALERTS: 'nancy_alerts_v1',
  ACTIVITY: 'nancy_activity_v1',
  SETTINGS: 'nancy_settings_v1',
  PROFILE: 'nancy_user_profile_v1',
};

export interface AppSettings {
  language: LanguageCode;
  wakeModeEnabled: boolean;
  autoAIEnabled: boolean;
  themeAccent: 'cyan' | 'purple' | 'emerald' | 'amber';
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  selectedVoiceIndex: number;
  hardwareDefaultIp: string;
  hardwareDefaultPort: number;
  alertSoundEnabled: boolean;
  cameraFacingMode: 'user' | 'environment';
}

const defaultSettings: AppSettings = {
  language: 'en',
  wakeModeEnabled: false,
  autoAIEnabled: true,
  themeAccent: 'cyan',
  speechRate: 1.0,
  speechPitch: 1.05,
  speechVolume: 1.0,
  selectedVoiceIndex: 0,
  hardwareDefaultIp: '192.168.4.1',
  hardwareDefaultPort: 80,
  alertSoundEnabled: true,
  cameraFacingMode: 'user',
};

export const defaultProfile: UserProfile = {
  id: 'user-primary',
  name: 'Kunddan Raj',
  callingName: 'Kunddan',
  title: 'Lead AI Engineer',
  bio: 'Computer vision developer, robotics engineer, and AI explorer.',
  avatarIcon: 'cpu',
  city: 'New Delhi',
  preferredLanguage: 'en',
  voicePitch: 1.05,
  voiceRate: 1.0,
  voiceVolume: 1.0,
  selectedVoiceIndex: 0,
  theme: 'cyan',
  communicationStyle: 'tactical',
  learnedHabits: [
    {
      id: 'habit-1',
      category: 'vision',
      observation: 'Prefers real-time COCO-SSD continuous object detection with sensitive thresholds',
      confidence: 0.95,
      detectedCount: 16,
      lastUpdated: new Date().toLocaleDateString(),
    },
    {
      id: 'habit-2',
      category: 'interaction',
      observation: 'Uses bilingual voice interactions in both English and Hindi',
      confidence: 0.92,
      detectedCount: 12,
      lastUpdated: new Date().toLocaleDateString(),
    },
    {
      id: 'habit-3',
      category: 'hardware',
      observation: 'Interacts with ESP32 IoT automation and relay switching controls',
      confidence: 0.85,
      detectedCount: 9,
      lastUpdated: new Date().toLocaleDateString(),
    },
  ],
  privacy: {
    saveChatHistory: true,
    saveVoiceActivity: true,
    saveVisionSnapshots: true,
    allowHabitLearning: true,
    incognitoMode: false,
  },
  createdAt: new Date().toLocaleDateString(),
  lastActiveAt: new Date().toLocaleDateString(),
};

const initialMemories: MemoryItem[] = [
  {
    id: 'mem-1',
    title: 'Assistant Identity Protocol',
    content: 'USE VISION AI: Universal Sensory & Executive Vision Artificial Intelligence. Primary mission: Personal assistance, computer vision, robotics telemetry, and high-order reasoning.',
    category: 'personal',
    tags: ['core', 'identity', 'protocol'],
    pinned: true,
    createdAt: new Date().toLocaleDateString(),
  },
  {
    id: 'mem-2',
    title: 'ESP32 NodeMCU Pinout Config',
    content: 'GPIO 2: Status LED, GPIO 18: Servo PWM, GPIO 22: I2C SCL (BME280), GPIO 21: I2C SDA, GPIO 4: Ultrasonic Trigger, GPIO 5: Ultrasonic Echo.',
    category: 'hardware',
    tags: ['esp32', 'pinout', 'sensors'],
    pinned: true,
    createdAt: new Date().toLocaleDateString(),
  },
];

const initialKnowledge: CustomKnowledge[] = [
  {
    id: 'k-1',
    question: 'Who are you?',
    answer: 'I am USE VISION AI, an advanced multifunctional personal AI assistant engineered for intelligent computer vision, voice interaction, and IoT hardware control.',
    category: 'Identity',
    createdAt: new Date().toLocaleDateString(),
  },
  {
    id: 'k-2',
    question: 'तुम कौन हो?',
    answer: 'मैं यूज़ विज़न एआई (USE VISION AI) हूँ, आपकी आधुनिक व्यक्तिगत कृत्रिम बुद्धिमत्ता सहायक। मैं कंप्यूटर विज़न, आवाज़ और स्मार्ट हार्डवेयर नियंत्रण में आपकी मदद करती हूँ।',
    category: 'Hindi Identity',
    createdAt: new Date().toLocaleDateString(),
  },
  {
    id: 'k-3',
    question: 'What hardware can you control?',
    answer: 'I can interface with ESP32 microcontrollers, Arduino via Web Serial, Bluetooth LE devices, and custom IP relays to read sensor telemetrics and toggle actuators.',
    category: 'Hardware',
    createdAt: new Date().toLocaleDateString(),
  },
];

const initialAlerts: NancyAlert[] = [
  {
    id: 'alert-1',
    title: 'Sensor Hub Online',
    description: 'Hardware telemetrics stream initialized. Telemetry sample frequency: 2Hz.',
    severity: 'info',
    timestamp: new Date().toLocaleTimeString(),
    read: true,
    category: 'system',
  },
];

const initialActivity: ActivityEvent[] = [
  {
    id: 'act-1',
    title: 'USE VISION AI Core Initialized',
    detail: 'Autonomous neural sub-routines, computer vision, and sensory systems ready.',
    category: 'system',
    timestamp: new Date().toLocaleTimeString(),
    status: 'success',
  },
];

class StorageService {
  // Memories
  public getMemories(): MemoryItem[] {
    try {
      const data = localStorage.getItem(KEYS.MEMORIES);
      return data ? JSON.parse(data) : initialMemories;
    } catch {
      return initialMemories;
    }
  }

  public saveMemories(memories: MemoryItem[]) {
    try {
      localStorage.setItem(KEYS.MEMORIES, JSON.stringify(memories));
    } catch {}
  }

  public addMemory(item: MemoryItem) {
    try {
      const current = this.getMemories();
      this.saveMemories([item, ...current]);
    } catch {}
  }

  // Faces
  public getFaceEnrollments(): FaceEnrollment[] {
    try {
      const data = localStorage.getItem(KEYS.FACES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveFaceEnrollments(faces: FaceEnrollment[]) {
    try {
      localStorage.setItem(KEYS.FACES, JSON.stringify(faces));
    } catch {}
  }

  // Custom Knowledge
  public getKnowledge(): CustomKnowledge[] {
    try {
      const data = localStorage.getItem(KEYS.KNOWLEDGE);
      return data ? JSON.parse(data) : initialKnowledge;
    } catch {
      return initialKnowledge;
    }
  }

  public saveKnowledge(items: CustomKnowledge[]) {
    try {
      localStorage.setItem(KEYS.KNOWLEDGE, JSON.stringify(items));
    } catch {}
  }

  // Alerts
  public getAlerts(): NancyAlert[] {
    try {
      const data = localStorage.getItem(KEYS.ALERTS);
      return data ? JSON.parse(data) : initialAlerts;
    } catch {
      return initialAlerts;
    }
  }

  public saveAlerts(alerts: NancyAlert[]) {
    try {
      localStorage.setItem(KEYS.ALERTS, JSON.stringify(alerts.slice(0, 50)));
    } catch {}
  }

  // Activity Log
  public getActivity(): ActivityEvent[] {
    try {
      const data = localStorage.getItem(KEYS.ACTIVITY);
      return data ? JSON.parse(data) : initialActivity;
    } catch {
      return initialActivity;
    }
  }

  public logActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>) {
    const list = this.getActivity();
    const newEvent: ActivityEvent = {
      ...event,
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleTimeString(),
    };
    const updated = [newEvent, ...list].slice(0, 100);
    try {
      localStorage.setItem(KEYS.ACTIVITY, JSON.stringify(updated));
    } catch {}
    return updated;
  }

  public clearActivity() {
    try {
      localStorage.setItem(KEYS.ACTIVITY, JSON.stringify([]));
    } catch {}
  }

  // Settings
  public getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  }

  public saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }

  // User Profile & Habit Learning
  public getUserProfile(): UserProfile {
    try {
      const data = localStorage.getItem(KEYS.PROFILE);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...defaultProfile,
          ...parsed,
          privacy: { ...defaultProfile.privacy, ...(parsed.privacy || {}) },
          learnedHabits: Array.isArray(parsed.learnedHabits) ? parsed.learnedHabits : defaultProfile.learnedHabits,
        };
      }
      return defaultProfile;
    } catch {
      return defaultProfile;
    }
  }

  public saveUserProfile(profile: UserProfile) {
    try {
      const updated = { ...profile, lastActiveAt: new Date().toLocaleDateString() };
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(updated));

      // Synchronize with AppSettings theme and language
      const settings = this.getSettings();
      this.saveSettings({
        ...settings,
        language: profile.preferredLanguage,
        themeAccent: profile.theme,
        speechPitch: profile.voicePitch,
        speechRate: profile.voiceRate,
        speechVolume: profile.voiceVolume,
        selectedVoiceIndex: profile.selectedVoiceIndex,
      });
    } catch {}
  }

  public learnHabit(observation: string, category: UserHabit['category'], confidence = 0.88) {
    try {
      const profile = this.getUserProfile();
      // If user disabled learning or is in incognito mode, do not store
      if (!profile.privacy.allowHabitLearning || profile.privacy.incognitoMode) {
        return;
      }

      const existingIndex = profile.learnedHabits.findIndex(
        (h) => h.observation.toLowerCase().trim() === observation.toLowerCase().trim()
      );

      let updatedHabits = [...profile.learnedHabits];
      if (existingIndex >= 0) {
        const existing = updatedHabits[existingIndex];
        updatedHabits[existingIndex] = {
          ...existing,
          detectedCount: existing.detectedCount + 1,
          confidence: Math.min(0.99, Number((existing.confidence + 0.02).toFixed(2))),
          lastUpdated: new Date().toLocaleDateString(),
        };
      } else {
        const newHabit: UserHabit = {
          id: `habit-${Date.now()}`,
          category,
          observation,
          confidence,
          detectedCount: 1,
          lastUpdated: new Date().toLocaleDateString(),
        };
        updatedHabits = [newHabit, ...updatedHabits].slice(0, 20); // Keep top 20 habits
      }

      this.saveUserProfile({
        ...profile,
        learnedHabits: updatedHabits,
      });
    } catch (e) {
      console.warn('Habit learning error:', e);
    }
  }

  public deleteHabit(habitId: string) {
    try {
      const profile = this.getUserProfile();
      const updatedHabits = profile.learnedHabits.filter((h) => h.id !== habitId);
      this.saveUserProfile({ ...profile, learnedHabits: updatedHabits });
    } catch {}
  }

  public clearAllHabits() {
    try {
      const profile = this.getUserProfile();
      this.saveUserProfile({ ...profile, learnedHabits: [] });
    } catch {}
  }

  // Privacy & Wipe
  public wipeUserData() {
    try {
      localStorage.removeItem(KEYS.MEMORIES);
      localStorage.removeItem(KEYS.ACTIVITY);
      localStorage.removeItem(KEYS.ALERTS);
      this.clearAllHabits();
    } catch {}
  }

  // Full backup & restore
  public exportAllData(): string {
    const backup = {
      version: '3.0',
      exportDate: new Date().toISOString(),
      profile: this.getUserProfile(),
      memories: this.getMemories(),
      faces: this.getFaceEnrollments(),
      knowledge: this.getKnowledge(),
      settings: this.getSettings(),
      activityLog: this.getActivity(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public importData(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.profile) this.saveUserProfile(data.profile);
      if (data.memories) this.saveMemories(data.memories);
      if (data.faces) this.saveFaceEnrollments(data.faces);
      if (data.knowledge) this.saveKnowledge(data.knowledge);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Failed to import backup data:', e);
      return false;
    }
  }
}

export const storageService = new StorageService();
