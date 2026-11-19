/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  AssistantState,
  ChatMessage,
  HardwareState,
  LanguageCode,
  SensorData,
  UserProfile,
} from './types/nancy';
import { speechService, SpeechState } from './services/speechService';
import { hardwareService } from './services/hardwareService';
import { storageService, AppSettings } from './services/storageService';
import { playAudioFx } from './services/audioSynth';

import { Header } from './components/Header';
import { AssistantCore } from './components/AssistantCore';
import { BottomNav, NavTab } from './components/BottomNav';
import { ChatView } from './components/ChatView';
import { DataDisplayView } from './components/DataDisplayView';
import { SettingsView } from './components/SettingsView';
import { ModulesMenuModal, ActiveModule } from './components/ModulesMenuModal';
import { AndroidApkModal } from './components/AndroidApkModal';
import { VoiceGuideModal } from './components/VoiceGuideModal';
import { UserProfileModal } from './components/UserProfileModal';
import { OfflineIndicator } from './components/OfflineIndicator';

// Functional Module Modals
import { HardwareHubModal } from './components/modules/HardwareHubModal';
import { VisionAIModal } from './components/modules/VisionAIModal';
import { FaceIntelligenceModal } from './components/modules/FaceIntelligenceModal';
import { GestureAIModal } from './components/modules/GestureAIModal';
import { HealthAIModal } from './components/modules/HealthAIModal';
import { AlertsModal } from './components/modules/AlertsModal';

import {
  Radio,
  Eye,
  UserCheck,
  Hand,
  HeartPulse,
  Bell,
  Layers,
  ChevronRight,
  Volume2,
  Zap,
} from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => storageService.getUserProfile());
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [activeModule, setActiveModule] = useState<ActiveModule>(null);
  const [showModulesMenu, setShowModulesMenu] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [hardwareState, setHardwareState] = useState<HardwareState>(() => hardwareService.getState());
  const [sensorData, setSensorData] = useState<SensorData>(() => hardwareService.getSensorData());
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(() => {
    return storageService.getAlerts().filter((a) => !a.read).length;
  });
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'USE VISION AI online. Universal sensory neural link initialized. Speak a command, explore computer vision, or connect hardware modules.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'local',
    },
  ]);

  const isProcessingCommandRef = useRef(false);
  const lastCommandTextRef = useRef('');
  const lastCommandTimeRef = useRef(0);

  // Subscribe to Telemetry
  useEffect(() => {
    const unsubTelemetry = hardwareService.subscribeTelemetry((data) => {
      setSensorData(data);
      setHardwareState(hardwareService.getState());

      // Check alert thresholds only when an external hardware controller is actively streaming
      if (hardwareService.isControllerConnected()) {
        if (data.temperature > 36.0) {
          triggerSystemAlert(
            'Thermal Threshold Exceeded',
            `Sensor temperature peaked at ${data.temperature}°C. Cooling protocol recommended.`,
            'warning'
          );
        } else if (data.distance > 0 && data.distance < 12) {
          triggerSystemAlert(
            'Proximity Collision Barrier',
            `Ultrasonic obstacle detected at ${data.distance} cm!`,
            'critical'
          );
        }
      }
    });

    return () => {
      unsubTelemetry();
    };
  }, []);

  // Vision AI model initializes on-demand inside VisionAIModal so initial boot & other modules stay instant

  // Voice Service Subscriptions
  useEffect(() => {
    speechService.setLanguage(settings.language);
    speechService.setVoiceSettings(
      settings.speechVolume,
      settings.speechPitch,
      settings.speechRate,
      settings.selectedVoiceIndex
    );

    speechService.onTranscript((text, isFinal) => {
      setTranscript(text);
      if (isFinal) {
        handleExecuteVoiceCommand(text);
      }
    });

    speechService.onStateChange((state: SpeechState) => {
      setIsListening(state === 'listening');
      if (state === 'speaking') {
        setAssistantState('speaking');
      } else if (state === 'listening') {
        setAssistantState('listening');
      } else if (!isProcessingCommandRef.current) {
        setAssistantState('idle');
      }
    });

    speechService.onWake(() => {
      setAssistantState('listening');
    });
  }, [settings.language]);

  // Android Back Button & Popstate Handling
  useEffect(() => {
    const handlePopState = () => {
      if (activeModule) {
        setActiveModule(null);
      } else if (showModulesMenu) {
        setShowModulesMenu(false);
      } else if (showApkModal) {
        setShowApkModal(false);
      } else if (showVoiceGuide) {
        setShowVoiceGuide(false);
      } else if (currentTab !== 'home') {
        setCurrentTab('home');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handlePopState();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModule, showModulesMenu, showApkModal, showVoiceGuide, currentTab]);

  const openModule = (mod: ActiveModule) => {
    playAudioFx.click();
    window.history.pushState({ module: mod }, '');
    setActiveModule(mod);
    setShowModulesMenu(false);
  };

  const triggerSystemAlert = (title: string, description: string, severity: 'critical' | 'warning' | 'info') => {
    const currentAlerts = storageService.getAlerts();
    const isDuplicate = currentAlerts.slice(0, 3).some((a) => a.title === title);
    if (isDuplicate) return;

    const newAlert = {
      id: 'al-' + Date.now(),
      title,
      description,
      severity,
      timestamp: new Date().toLocaleTimeString(),
      read: false,
      category: 'sensor' as const,
    };
    storageService.saveAlerts([newAlert, ...currentAlerts]);
    setUnreadAlertCount((c) => c + 1);
    storageService.logActivity({
      title: `ALERT: ${title}`,
      detail: description,
      category: 'hardware',
      status: 'warning',
    });
  };

  // Central Command Processor
  const handleExecuteVoiceCommand = async (commandText: string) => {
    const cleanCmd = (commandText || '').trim();
    const lower = cleanCmd.toLowerCase();
    if (!lower) return;

    const now = Date.now();
    // Guard against rapid duplicate voice triggers
    if (
      cleanCmd.toLowerCase() === lastCommandTextRef.current.toLowerCase() &&
      now - lastCommandTimeRef.current < 2500
    ) {
      return;
    }

    if (isProcessingCommandRef.current) {
      return;
    }

    lastCommandTextRef.current = cleanCmd;
    lastCommandTimeRef.current = now;
    isProcessingCommandRef.current = true;

    // Append user message
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: cleanCmd,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    storageService.logActivity({
      title: `Voice Command Recognized`,
      detail: cleanCmd,
      category: 'voice',
      status: 'info',
    });

    // Learn user habit if enabled
    if (userProfile.privacy?.allowHabitLearning !== false) {
      storageService.learnHabit(cleanCmd, 'interaction');
      setUserProfile(storageService.getUserProfile());
    }

    setAssistantState('processing');

    try {
      // 1. Built-in High Speed Automations
      if (lower.includes('light on') || lower.includes('turn on light') || lower.includes('लाइट चालू')) {
        hardwareService.toggleRelay(0);
        playAudioFx.acknowledge();
        const reply = settings.language === 'hi' ? 'रिले 1 और लाइट चालू कर दी गई है।' : 'Relay 1 and LED light powered ON.';
        respondAndSpeak(reply, 'local');
        return;
      }

      if (lower.includes('light off') || lower.includes('turn off light') || lower.includes('लाइट बंद')) {
        hardwareService.toggleRelay(0);
        playAudioFx.acknowledge();
        const reply = settings.language === 'hi' ? 'लाइट बंद कर दी गई है।' : 'Relay 1 and LED light switched OFF.';
        respondAndSpeak(reply, 'local');
        return;
      }

      // Real-time Date query
      if (lower.includes('date') || lower.includes('tarikh') || lower.includes('तारीख') || lower.includes('aaj kya din') || lower.includes('what day is today') || lower.includes('today\'s date')) {
        playAudioFx.acknowledge();
        const now = new Date();
        const dateHI = now.toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
        const timeHI = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        const dateEN = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeEN = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const reply = settings.language === 'hi'
          ? `आज की तारीख है: ${dateHI}। वर्तमान समय है: ${timeHI} (IST)।`
          : `Today's real-time date is ${dateEN}. Current time is ${timeEN}.`;
        respondAndSpeak(reply, 'local');
        return;
      }

      // Real-time Time query
      if (lower.includes('time') || lower.includes('samay') || lower.includes('समय') || lower.includes('kitne baje') || lower.includes('घड़ी') || lower.includes('current time')) {
        playAudioFx.acknowledge();
        const now = new Date();
        const timeHI = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        const timeEN = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const reply = settings.language === 'hi'
          ? `अभी वास्तविक समय है: ${timeHI} (IST)।`
          : `The current real-time clock is ${timeEN}.`;
        respondAndSpeak(reply, 'local');
        return;
      }

      // Real-time Sensor & Hardware Data Telemetry query
      if (
        lower.includes('telemetry') ||
        lower.includes('sensor data') ||
        lower.includes('real time data') ||
        lower.includes('realtime') ||
        lower.includes('सेंसर') ||
        lower.includes('लाइव डेटा') ||
        lower.includes('real data') ||
        lower.includes('रियल डेटा') ||
        lower.includes('real hardware') ||
        lower.includes('हार्डवेयर डेटा')
      ) {
        playAudioFx.acknowledge();
        if (!hardwareService.isControllerConnected()) {
          const reply = settings.language === 'hi'
            ? 'अभी कोई ESP32 या कंट्रोलर IP एड्रेस से कनेक्ट नहीं है। कृपया DATA टैब में जाकर कंट्रोलर का IP एड्रेस कनेक्ट करें।'
            : 'No ESP32 or hardware controller is connected yet. Open the DATA tab and connect your controller by IP address to stream real-time sensor data.';
          respondAndSpeak(reply, 'local');
          return;
        }
        const reply = settings.language === 'hi'
          ? `कनेक्टेड कंट्रोलर लाइव डेटा (${hardwareState.deviceIp || hardwareState.type}):
• तापमान: ${sensorData.temperature}°C | आर्द्रता: ${sensorData.humidity}%
• दूरी: ${sensorData.distance} cm | लाइट: ${sensorData.ambientLight} Lux
• वोल्टेज: ${sensorData.voltage}V | पल्स: ${sensorData.heartRate} BPM
• पैकेट्स: ${sensorData.controllerPackets ?? 0} | लेटेंसी: ${sensorData.controllerLatencyMs ?? sensorData.networkLatency ?? 0}ms`
          : `Connected Controller Live Data (${hardwareState.deviceIp || hardwareState.type}):
• Temp: ${sensorData.temperature}°C | Humidity: ${sensorData.humidity}%
• Distance: ${sensorData.distance} cm | Light: ${sensorData.ambientLight} Lux
• Voltage: ${sensorData.voltage}V | Pulse: ${sensorData.heartRate} BPM
• Packets: ${sensorData.controllerPackets ?? 0} | Latency: ${sensorData.controllerLatencyMs ?? sensorData.networkLatency ?? 0}ms`;
        respondAndSpeak(reply, 'local');
        return;
      }

      if (lower === 'temperature' || lower === 'temp' || lower === 'तापमान' || lower === 'current temperature' || lower === 'aaj ka tapman') {
        playAudioFx.acknowledge();
        if (!hardwareService.isControllerConnected()) {
          const reply = settings.language === 'hi'
            ? 'अभी कोई ESP32 या कंट्रोलर कनेक्ट नहीं है। DATA टैब से IP एड्रेस द्वारा कंट्रोलर कनेक्ट करें।'
            : 'No controller connected via IP address. Connect your ESP32 in the DATA tab to read live temperature.';
          respondAndSpeak(reply, 'local');
          return;
        }
        const reply = settings.language === 'hi'
          ? `कनेक्टेड कंट्रोलर तापमान ${sensorData.temperature} डिग्री सेल्सियस और आर्द्रता ${sensorData.humidity} प्रतिशत है।`
          : `Connected controller reports temperature at ${sensorData.temperature}°C with ${sensorData.humidity}% humidity.`;
        respondAndSpeak(reply, 'local');
        return;
      }

      // Explicit Vision AI module launch command ONLY (not general questions or troubleshooting)
      const isExplicitLaunchVision =
        (lower.startsWith('open camera') ||
          lower.startsWith('launch camera') ||
          lower.startsWith('start camera') ||
          lower.startsWith('open vision') ||
          lower.startsWith('कैमरा खोलो') ||
          lower.startsWith('कैमरा चालू करो') ||
          lower.includes('what objects are visible') ||
          lower.includes('सामने क्या ऑब्जेक्ट है') ||
          lower === 'camera' ||
          lower === 'vision ai') &&
        !lower.includes('kyu') &&
        !lower.includes('why') &&
        !lower.includes('kaise') &&
        !lower.includes('how') &&
        !lower.includes('nahi') &&
        !lower.includes('nhi');

      if (isExplicitLaunchVision) {
        openModule('vision_ai');
        const reply =
          settings.language === 'hi'
            ? 'विज़न एआई लाइव HUD सक्रिय कर दिया गया है। सामने मौजूद ऑब्जेक्ट्स को रियल-टाइम में ट्रैक किया जा रहा है।'
            : 'USE VISION AI Live Optical HUD active. Real-time object and spatial tracking engaged.';
        respondAndSpeak(reply, 'local');
        return;
      }

      // Explicit Face intelligence launch command
      const isExplicitLaunchFace =
        (lower.startsWith('open face') ||
          lower.startsWith('launch face') ||
          lower.startsWith('फेस खोलो') ||
          lower.startsWith('चेहरा स्कैनर खोलो') ||
          lower === 'face intelligence') &&
        !lower.includes('kyu') &&
        !lower.includes('why') &&
        !lower.includes('kaise') &&
        !lower.includes('how');

      if (isExplicitLaunchFace) {
        openModule('face_intelligence');
        const reply = settings.language === 'hi' ? 'फेस इंटेलिजेंस बायोमेट्रिक स्कैनर खोल रही हूँ।' : 'Opening Face Intelligence biometric mesh.';
        respondAndSpeak(reply, 'local');
        return;
      }

      // Explicit Gesture AI launch command
      const isExplicitLaunchGesture =
        (lower.startsWith('open gesture') ||
          lower.startsWith('launch gesture') ||
          lower.startsWith('जेस्चर खोलो') ||
          lower === 'gesture ai') &&
        !lower.includes('kyu') &&
        !lower.includes('why') &&
        !lower.includes('kaise');

      if (isExplicitLaunchGesture) {
        openModule('gesture_ai');
        const reply = settings.language === 'hi' ? 'जेस्चर एआई हैंड ट्रैकर शुरू किया गया।' : 'Initiating 21-joint Gesture AI controller.';
        respondAndSpeak(reply, 'local');
        return;
      }

      // Explicit Hardware Hub launch command
      const isExplicitLaunchHardware =
        (lower.startsWith('open hardware') ||
          lower.startsWith('हार्डवेयर खोलो') ||
          lower === 'hardware hub') &&
        !lower.includes('kyu') &&
        !lower.includes('why');

      if (isExplicitLaunchHardware) {
        openModule('hardware_hub');
        const reply = settings.language === 'hi' ? 'हार्डवेयर हब प्रबंधन खोल रही हूँ।' : 'Opening Hardware Hub telemetry panel.';
        respondAndSpeak(reply, 'local');
        return;
      }

      // Explicit Alarm trigger
      if (
        lower === 'alarm' ||
        lower === 'sound alarm' ||
        lower === 'start alarm' ||
        lower.startsWith('alarm on') ||
        lower.startsWith('अलार्म बजाओ') ||
        lower.startsWith('सायरन बजाओ')
      ) {
        playAudioFx.alertSiren();
        hardwareService.triggerBuzzer(800);
        const reply = settings.language === 'hi' ? 'अलार्म सायरन और बज़र बजा दिया गया है।' : 'Audio siren and hardware piezo buzzer discharged.';
        respondAndSpeak(reply, 'local');
        return;
      }

      if (lower.includes('who are you') || lower.includes('तुम कौन हो') || lower.includes('identity')) {
        playAudioFx.wakeChime();
        const reply = settings.language === 'hi'
          ? 'मैं यूज़ विज़न एआई (USE VISION AI) हूँ। मैं कंप्यूटर विज़न, आवाज़, रोबोटिक्स और स्मार्ट हार्डवेयर नियंत्रण में आपकी मदद करती हूँ।'
          : 'I am USE VISION AI, an advanced multifunctional personal AI assistant engineered for real-time computer vision, voice control, and IoT hardware automation.';
        respondAndSpeak(reply, 'local');
        return;
      }

      // 2. Custom Knowledge Matching
      const userKnowledge = storageService.getKnowledge();
      const match = userKnowledge.find((k) =>
        lower.includes(k.question.toLowerCase().trim())
      );
      if (match) {
        playAudioFx.acknowledge();
        respondAndSpeak(match.answer, 'local');
        return;
      }

      // 3. Fallthrough: Server-Side Gemini AI Chat with Real-Time Grounding
      try {
        if (
          lower.includes('my profile') ||
          lower.includes('mera profile') ||
          lower.includes('profile dikhao') ||
          lower.includes('open profile') ||
          lower.includes('प्रोफाइल')
        ) {
          setShowProfileModal(true);
          const userName = userProfile.callingName || userProfile.name || 'User';
          const reply =
            settings.language === 'hi'
              ? `नमस्ते ${userName} जी! आपका यूज़र प्रोफाइल और सीखी गई आदतें खोल दी गई हैं।`
              : `Opening your user profile and learned preferences, ${userName}.`;
          respondAndSpeak(reply, 'local');
          return;
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanCmd,
            language: settings.language,
            history: messages.slice(-5),
            userKnowledge,
            sensorTelemetry: sensorData,
            userProfile,
          }),
        });
        const data = await res.json();
        const reply = data.reply || "USE VISION AI neural core received your query.";
        respondAndSpeak(reply, data.source || 'gemini', data.groundingSources);
      } catch {
        const fallback = settings.language === 'hi'
          ? `[लोकल मोड] आदेश दर्ज किया गया: "${cleanCmd}"। क्लाउड लिंक ऑफलाइन है, लेकिन स्थानीय नियंत्रण सक्रिय है।`
          : `[Autonomous Local Matrix] Acknowledged: "${cleanCmd}". Local sensory controls remain fully operational.`;
        respondAndSpeak(fallback, 'local');
      }
    } finally {
      // Release processing lock if not transitioned to speaking
      setTimeout(() => {
        isProcessingCommandRef.current = false;
      }, 500);
    }
  };

  const respondAndSpeak = (
    reply: string,
    source: 'gemini' | 'local' | 'google_search' = 'gemini',
    groundingSources?: Array<{ title: string; url: string }>
  ) => {
    const aiMsg: ChatMessage = {
      id: 'ai-' + Date.now(),
      role: 'assistant',
      content: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: source as any,
      groundingSources,
    };
    setMessages((prev) => [...prev, aiMsg]);
    setAssistantState('speaking');
    speechService.speak(reply, () => {
      isProcessingCommandRef.current = false;
      setAssistantState('idle');
    });
  };

  const handleToggleLanguage = () => {
    playAudioFx.click();
    const nextLang: LanguageCode = settings.language === 'en' ? 'hi' : 'en';
    const updated = { ...settings, language: nextLang };
    setSettings(updated);
    storageService.saveSettings(updated);
    speechService.setLanguage(nextLang);
  };

  const handleToggleWake = () => {
    playAudioFx.click();
    const next = !settings.wakeModeEnabled;
    const updated = { ...settings, wakeModeEnabled: next };
    setSettings(updated);
    storageService.saveSettings(updated);
    speechService.setWakeMode(next);
  };

  const handleToggleAutoAI = () => {
    playAudioFx.click();
    const next = !settings.autoAIEnabled;
    const updated = { ...settings, autoAIEnabled: next };
    setSettings(updated);
    storageService.saveSettings(updated);
  };

  const isControllerConnected =
    hardwareState.isConnected &&
    (hardwareState.type === 'esp32_wifi' ||
      hardwareState.type === 'serial' ||
      hardwareState.type === 'bluetooth');

  // 6 Functional Modules Catalog
  const moduleBlocks = [
    {
      id: 'hardware_hub' as const,
      num: '01',
      name: 'Hardware Hub',
      desc: 'ESP32, BLE, Serial & Relays',
      icon: <Radio className="w-5 h-5 text-cyan-400" />,
      tag: 'IoT Core',
      status: isControllerConnected ? 'CONNECTED' : 'STANDBY',
      color: 'from-cyan-950/70 to-blue-950/60 border-cyan-500/30',
    },
    {
      id: 'vision_ai' as const,
      num: '02',
      name: 'Vision AI',
      desc: 'Real-time Object Tracker & HUD',
      icon: <Eye className="w-5 h-5 text-teal-400" />,
      tag: 'Vision',
      status: 'CAMERA READY',
      color: 'from-teal-950/70 to-slate-950/60 border-teal-500/30',
    },
    {
      id: 'face_intelligence' as const,
      num: '03',
      name: 'Face Intelligence',
      desc: 'Biometrics & Face Enrollment',
      icon: <UserCheck className="w-5 h-5 text-sky-400" />,
      tag: 'Biometrics',
      status: 'MESH ARMED',
      color: 'from-sky-950/70 to-slate-950/60 border-sky-500/30',
    },
    {
      id: 'gesture_ai' as const,
      num: '04',
      name: 'Gesture AI',
      desc: '21-Joint MediaPipe Control',
      icon: <Hand className="w-5 h-5 text-amber-400" />,
      tag: 'Touchless',
      status: 'HAND TRACKER',
      color: 'from-amber-950/60 to-slate-950/60 border-amber-500/30',
    },
    {
      id: 'health_ai' as const,
      num: '05',
      name: 'Health AI',
      desc: 'Sensor Telemetry & Trends',
      icon: <HeartPulse className="w-5 h-5 text-rose-400" />,
      tag: 'Sensors',
      status: 'ACTIVE',
      color: 'from-rose-950/60 to-slate-950/60 border-rose-500/30',
    },
    {
      id: 'alerts' as const,
      num: '06',
      name: 'Alerts',
      desc: 'Threshold Warnings & Siren',
      icon: <Bell className="w-5 h-5 text-red-400" />,
      tag: 'Shield',
      status: unreadAlertCount > 0 ? `${unreadAlertCount} ACTIVE` : 'NOMINAL',
      color: 'from-red-950/60 to-slate-950/60 border-red-500/30',
    },
  ];

  return (
    <div className="relative min-h-screen w-full bg-[#070B14] text-slate-100 flex flex-col font-sans overflow-x-hidden">
      {/* Background Cyber Glow Fields */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute inset-0 cyber-scanlines opacity-40" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Header */}
        <Header
          assistantState={assistantState}
          userProfile={userProfile}
          onOpenProfile={() => {
            playAudioFx.click();
            setShowProfileModal(true);
          }}
          onOpenMenu={() => {
            playAudioFx.click();
            setShowModulesMenu(true);
          }}
          onOpenApkModal={() => {
            playAudioFx.click();
            setShowApkModal(true);
          }}
          onOpenHelp={() => {
            playAudioFx.click();
            setShowVoiceGuide(true);
          }}
        />

        {/* Tab 1: HOME DASHBOARD */}
        {currentTab === 'home' && (
          <main className="flex-1 flex flex-col items-center pb-24 px-3 sm:px-4">
            {/* Animated Central AI Assistant Visualization */}
            <AssistantCore
              assistantState={assistantState}
              transcript={transcript}
              isWakeActive={settings.wakeModeEnabled}
              onToggleWake={handleToggleWake}
              isAutoAI={settings.autoAIEnabled}
              onToggleAutoAI={handleToggleAutoAI}
              hardwareState={hardwareState}
              language={settings.language}
              onToggleLanguage={handleToggleLanguage}
              onQuickCommand={handleExecuteVoiceCommand}
            />



            {/* ORGANIZED HOME DASHBOARD MODULE BLOCKS */}
            <div className="w-full max-w-xl space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-cyber font-bold text-xs text-slate-200 tracking-wider">
                    MODULE SUBSYSTEMS ({moduleBlocks.length})
                  </span>
                </div>
                <span className="text-[10px] font-mono-cyber text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  ALL INTERACTIVE
                </span>
              </div>

              {/* Grid of Modules organized in sleek cards right on Home Dashboard */}
              <div className="grid grid-cols-2 gap-2.5">
                {moduleBlocks.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openModule(m.id)}
                    className={`p-3 rounded-2xl bg-gradient-to-br ${m.color} border text-left flex flex-col justify-between hover:scale-[1.02] active:scale-95 transition-all shadow-md group cursor-pointer relative overflow-hidden`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 group-hover:border-cyan-400/60 transition-colors shadow-inner">
                        {m.icon}
                      </div>
                      <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-black/60 text-slate-300 border border-white/10">
                        {m.tag}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-tech font-bold text-slate-100 text-xs block group-hover:text-cyan-300 transition-colors">
                          {m.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans line-clamp-1 block mt-0.5">
                        {m.desc}
                      </span>
                      <div className="mt-2 pt-1 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[8px] font-mono-cyber text-slate-500">
                          MOD {m.num}
                        </span>
                        <span className="text-[9px] font-mono-cyber text-cyan-400 font-bold truncate">
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </main>
        )}

        {/* Tab 2: CHAT VIEW */}
        {currentTab === 'chat' && (
          <main className="flex-1 flex flex-col">
            <ChatView
              messages={messages}
              onSendMessage={handleExecuteVoiceCommand}
              onClearChat={() => {
                playAudioFx.click();
                setMessages([]);
              }}
              language={settings.language}
              isListening={isListening}
              onToggleMic={() => {
                playAudioFx.click();
                speechService.toggleListening();
              }}
              interimTranscript={transcript}
            />
          </main>
        )}

        {/* Tab 3: DATA DISPLAY VIEW */}
        {currentTab === 'data' && (
          <main className="flex-1 flex flex-col">
            <DataDisplayView
              sensorData={sensorData}
              hardwareState={hardwareState}
              language={settings.language}
              onOpenHardwareHub={() => openModule('hardware_hub')}
            />
          </main>
        )}

        {/* Tab 4: SETTINGS VIEW */}
        {currentTab === 'settings' && (
          <main className="flex-1 flex flex-col">
            <SettingsView
              settings={settings}
              userProfile={userProfile}
              onUpdateSettings={setSettings}
              onOpenApkModal={() => setShowApkModal(true)}
              onOpenProfile={() => {
                playAudioFx.click();
                setShowProfileModal(true);
              }}
            />
          </main>
        )}

        {/* Navigation Buttons: HOME, CHAT, DATA, SETTINGS */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          unreadAlertCount={unreadAlertCount}
          isControllerConnected={isControllerConnected}
        />
      </div>

      <OfflineIndicator />

      {/* Floating Modules Launcher Modal (from Menu Icon) */}
      {showModulesMenu && (
        <ModulesMenuModal
          onClose={() => setShowModulesMenu(false)}
          onSelectModule={(mod) => openModule(mod)}
          unreadAlertCount={unreadAlertCount}
        />
      )}

      {/* Android WebView / APK Packaging Modal */}
      {showApkModal && (
        <AndroidApkModal onClose={() => setShowApkModal(false)} />
      )}

      {/* Voice Guide Modal */}
      {showVoiceGuide && (
        <VoiceGuideModal
          onClose={() => setShowVoiceGuide(false)}
          onExecuteCommand={handleExecuteVoiceCommand}
        />
      )}

      {/* INDEPENDENT FUNCTIONAL MODULE MODALS */}
      {activeModule === 'hardware_hub' && (
        <HardwareHubModal
          onClose={() => setActiveModule(null)}
          hardwareState={hardwareState}
          sensorData={sensorData}
        />
      )}

      {activeModule === 'vision_ai' && (
        <VisionAIModal
          onClose={() => setActiveModule(null)}
          language={settings.language}
        />
      )}

      {activeModule === 'face_intelligence' && (
        <FaceIntelligenceModal
          onClose={() => setActiveModule(null)}
          language={settings.language}
        />
      )}

      {activeModule === 'gesture_ai' && (
        <GestureAIModal
          onClose={() => setActiveModule(null)}
          language={settings.language}
        />
      )}

      {activeModule === 'health_ai' && (
        <HealthAIModal
          onClose={() => setActiveModule(null)}
          sensorData={sensorData}
        />
      )}

      {activeModule === 'alerts' && (
        <AlertsModal
          onClose={() => setActiveModule(null)}
          onClearCount={() => setUnreadAlertCount(0)}
        />
      )}

      {/* User Profile & Habit Intelligence System Modal */}
      {showProfileModal && (
        <UserProfileModal
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={(updated) => {
            setUserProfile(updated);
            setSettings(storageService.getSettings());
            speechService.setLanguage(updated.preferredLanguage);
            speechService.setVoiceSettings(
              updated.voiceVolume,
              updated.voicePitch,
              updated.voiceRate,
              updated.selectedVoiceIndex
            );
          }}
        />
      )}
    </div>
  );
}
