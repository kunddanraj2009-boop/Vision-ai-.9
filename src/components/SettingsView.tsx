import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Mic,
  Languages,
  Palette,
  Camera,
  Radio,
  Shield,
  Smartphone,
  Check,
  RotateCcw,
  Sliders,
  User,
  Brain,
} from 'lucide-react';
import { AppSettings, storageService } from '../services/storageService';
import { UserProfile } from '../types/nancy';
import { speechService } from '../services/speechService';
import { playAudioFx } from '../services/audioSynth';

interface SettingsViewProps {
  settings: AppSettings;
  userProfile?: UserProfile;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onOpenApkModal: () => void;
  onOpenProfile?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  userProfile,
  onUpdateSettings,
  onOpenApkModal,
  onOpenProfile,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const list = speechService.getAvailableVoices();
    setVoices(list);
  }, []);

  const handleChange = (key: keyof AppSettings, val: any) => {
    const updated = { ...settings, [key]: val };
    onUpdateSettings(updated);
    storageService.saveSettings(updated);

    if (key === 'language') {
      speechService.setLanguage(val);
    } else if (key === 'wakeModeEnabled') {
      speechService.setWakeMode(val);
    } else if (
      key === 'speechRate' ||
      key === 'speechPitch' ||
      key === 'speechVolume' ||
      key === 'selectedVoiceIndex'
    ) {
      speechService.setVoiceSettings(
        updated.speechVolume,
        updated.speechPitch,
        updated.speechRate,
        updated.selectedVoiceIndex
      );
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleTestSpeech = () => {
    playAudioFx.click();
    speechService.speak(
      settings.language === 'hi'
        ? 'नमस्ते, यह यूज़ विज़न एआई (USE VISION AI) की आवाज़ की जांच है।'
        : 'USE VISION AI neural voice synthesizer calibration test nominal.'
    );
  };

  return (
    <div className="flex-1 overflow-y-auto max-w-xl mx-auto w-full px-4 py-3 pb-24 space-y-4 select-none text-xs font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div>
          <h2 className="font-cyber font-bold text-sm text-cyan-300">
            SYSTEM & ASSISTANT SETTINGS
          </h2>
          <p className="text-[10px] font-tech text-slate-400">
            PREFERENCES • AUDIO • HARDWARE • ANDROID APK
          </p>
        </div>
        {saved && (
          <span className="text-[10px] font-mono-cyber text-emerald-400 flex items-center space-x-1">
            <Check className="w-3.5 h-3.5" />
            <span>SAVED</span>
          </span>
        )}
      </div>

      {/* User Profile & Habit Learning Card */}
      {onOpenProfile && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-slate-900 to-indigo-950/70 border border-cyan-500/40 shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-tech font-bold text-xs text-slate-100">
                  {userProfile?.callingName || userProfile?.name || 'User Profile'}
                </span>
                <span className="text-[9px] font-mono-cyber px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                  {userProfile?.title || 'Personalized'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                Language • Voice Settings • {userProfile?.learnedHabits?.length || 0} Learned Habits • Privacy
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playAudioFx.click();
              onOpenProfile();
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-tech font-bold text-xs tracking-wider transition-all shadow-md shadow-cyan-500/30 active:scale-95"
          >
            EDIT PROFILE
          </button>
        </div>
      )}

      {/* Voice & Speech Controls */}
      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-cyan-400 font-tech font-bold text-xs">
            <Volume2 className="w-4 h-4" />
            <span>SYNTHESIS VOICE & SPEECH ENGINE</span>
          </div>
          <button
            onClick={handleTestSpeech}
            className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono-cyber text-[10px]"
          >
            TEST VOICE
          </button>
        </div>

        {/* Language Selection */}
        <div>
          <label className="text-[10px] text-slate-400 font-mono-cyber block mb-1">
            Primary Assistant Language
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleChange('language', 'en')}
              className={`py-2 rounded-lg font-tech font-bold transition-all ${
                settings.language === 'en'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}
            >
              English (US / Global)
            </button>
            <button
              onClick={() => handleChange('language', 'hi')}
              className={`py-2 rounded-lg font-tech font-bold transition-all ${
                settings.language === 'hi'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}
            >
              हिन्दी (Hindi)
            </button>
          </div>
        </div>

        {/* Speech Rate Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-slate-400 text-[10px] font-mono-cyber">
            <span>Speech Cadence (Rate): {settings.speechRate}x</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.4"
            step="0.05"
            value={settings.speechRate}
            onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Speech Pitch Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-slate-400 text-[10px] font-mono-cyber">
            <span>Vocal Pitch: {settings.speechPitch}</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.3"
            step="0.05"
            value={settings.speechPitch}
            onChange={(e) => handleChange('speechPitch', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Wake Word & Activation */}
      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="font-tech font-bold text-slate-200 block text-xs">
            Continuous Wake Word Detection
          </span>
          <span className="text-[10px] text-slate-400">
            Listens continuously for "Hey Vision" / "सुनो विज़न".
          </span>
        </div>
        <button
          onClick={() => handleChange('wakeModeEnabled', !settings.wakeModeEnabled)}
          className={`px-3 py-1.5 rounded-lg font-mono-cyber font-bold transition-colors ${
            settings.wakeModeEnabled
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
              : 'bg-slate-950 text-slate-500 border border-slate-800'
          }`}
        >
          {settings.wakeModeEnabled ? 'ACTIVE' : 'DISABLED'}
        </button>
      </div>

      {/* Hardware Defaults */}
      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
        <span className="font-tech font-bold text-slate-200 text-xs block">
          HARDWARE DEFAULT ENDPOINTS
        </span>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-[9px] text-slate-400 font-mono-cyber block mb-0.5">
              Default ESP32 IP
            </label>
            <input
              type="text"
              value={settings.hardwareDefaultIp}
              onChange={(e) => handleChange('hardwareDefaultIp', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono-cyber text-xs"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-400 font-mono-cyber block mb-0.5">
              Port
            </label>
            <input
              type="number"
              value={settings.hardwareDefaultPort}
              onChange={(e) => handleChange('hardwareDefaultPort', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono-cyber text-xs"
            />
          </div>
        </div>
      </div>

      {/* Android WebView & APK Packaging Info Button */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex items-center justify-between gap-2">
        <div>
          <span className="font-tech font-bold text-emerald-300 block text-xs">
            Android APK & Mobile App Export
          </span>
          <span className="text-[10px] text-slate-400">
            1-Tap Mobile Install + Download Complete Android Studio APK (.ZIP).
          </span>
        </div>
        <button
          onClick={onOpenApkModal}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-tech font-bold tracking-wider shrink-0"
        >
          GET APK / APP
        </button>
      </div>
    </div>
  );
};
