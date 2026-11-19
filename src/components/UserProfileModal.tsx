import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Settings,
  Brain,
  Shield,
  Save,
  Volume2,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Palette,
  Mic,
  Sliders,
  Globe,
  Plus,
  RefreshCw,
  Cpu,
  Bot,
  Zap,
  Terminal,
  ShieldCheck,
  EyeOff,
} from 'lucide-react';
import { UserProfile, UserHabit, ThemeAccent, LanguageCode } from '../types/nancy';
import { storageService } from '../services/storageService';
import { speechService } from '../services/speechService';
import { playAudioFx } from '../services/audioSynth';

interface UserProfileModalProps {
  onClose: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
}

type TabType = 'persona' | 'preferences' | 'habits' | 'privacy';

const AVATAR_ICONS = [
  { id: 'cpu', icon: Cpu, label: 'Core CPU' },
  { id: 'bot', icon: Bot, label: 'Cyber Bot' },
  { id: 'user', icon: User, label: 'Human' },
  { id: 'zap', icon: Zap, label: 'Neural Zap' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'shield', icon: ShieldCheck, label: 'Guardian' },
];

const THEME_OPTIONS: Array<{ id: ThemeAccent; label: string; color: string; border: string }> = [
  { id: 'cyan', label: 'Cyber Cyan', color: 'bg-cyan-500', border: 'border-cyan-500' },
  { id: 'purple', label: 'Neon Purple', color: 'bg-purple-500', border: 'border-purple-500' },
  { id: 'emerald', label: 'Emerald Matrix', color: 'bg-emerald-500', border: 'border-emerald-500' },
  { id: 'amber', label: 'Solar Amber', color: 'bg-amber-500', border: 'border-amber-500' },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ onClose, onProfileUpdated }) => {
  const [activeTab, setActiveTab] = useState<TabType>('persona');
  const [profile, setProfile] = useState<UserProfile>(() => storageService.getUserProfile());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [newHabitText, setNewHabitText] = useState('');
  const [newHabitCategory, setNewHabitCategory] = useState<UserHabit['category']>('topic');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  // Load browser voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const handleSave = () => {
    playAudioFx.acknowledge();
    storageService.saveUserProfile(profile);

    // Apply voice settings to speech service
    speechService.setLanguage(profile.preferredLanguage);
    speechService.setVoiceSettings(
      profile.voiceVolume,
      profile.voicePitch,
      profile.voiceRate,
      profile.selectedVoiceIndex
    );

    onProfileUpdated(profile);
    setSaveStatus(profile.preferredLanguage === 'hi' ? 'प्रोफ़ाइल सुरक्षित की गई!' : 'Profile successfully saved!');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // Live voice testing
  const handleTestVoice = () => {
    playAudioFx.click();
    speechService.setVoiceSettings(
      profile.voiceVolume,
      profile.voicePitch,
      profile.voiceRate,
      profile.selectedVoiceIndex
    );
    const salutation = profile.callingName || profile.name || 'User';
    const msg =
      profile.preferredLanguage === 'hi'
        ? `नमस्ते ${salutation}! मैं नैन्सी एआई हूँ। आपकी व्यक्तिगत आवाज और प्राथमिकताएं तैयार हैं।`
        : `Greetings ${salutation}! I am Nancy AI. Your customized voice telemetry is configured and ready.`;
    speechService.speak(msg);
  };

  // Add custom learned habit
  const handleAddCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitText.trim()) return;

    playAudioFx.click();
    storageService.learnHabit(newHabitText.trim(), newHabitCategory, 0.95);
    const updated = storageService.getUserProfile();
    setProfile(updated);
    onProfileUpdated(updated);
    setNewHabitText('');
  };

  // Delete habit
  const handleDeleteHabit = (id: string) => {
    playAudioFx.click();
    storageService.deleteHabit(id);
    const updated = storageService.getUserProfile();
    setProfile(updated);
    onProfileUpdated(updated);
  };

  // Clear all habits
  const handleClearHabits = () => {
    playAudioFx.click();
    storageService.clearAllHabits();
    const updated = storageService.getUserProfile();
    setProfile(updated);
    onProfileUpdated(updated);
  };

  // Export all user data as JSON
  const handleExportData = () => {
    playAudioFx.acknowledge();
    const dataStr = storageService.exportAllData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nancy-ai-user-profile-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Wipe data with confirmation
  const handleWipeData = () => {
    playAudioFx.alertSiren();
    storageService.wipeUserData();
    const updated = storageService.getUserProfile();
    setProfile(updated);
    onProfileUpdated(updated);
    setShowWipeConfirm(false);
    setSaveStatus(profile.preferredLanguage === 'hi' ? 'सभी डेटा रीसेट कर दिया गया।' : 'All user data wiped & reset.');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-xl max-h-[94vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl bg-slate-950/95 text-slate-100">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-cyber font-bold text-sm text-cyan-300 tracking-wide">
                  USER PROFILE & PERSONALIZATION
                </h2>
                <span className="text-[10px] font-mono-cyber px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  NANCY AI
                </span>
              </div>
              <p className="text-[10px] font-tech text-slate-400">
                CUSTOMIZE PREFERENCES • VOICE • HABIT LEARNING • PRIVACY
              </p>
            </div>
          </div>

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

        {/* Status Notification Toast */}
        {saveStatus && (
          <div className="px-4 py-1.5 bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-300 text-xs font-tech text-center flex items-center justify-center space-x-1.5 animate-in slide-in-from-top duration-150">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* 4 Navigation Tabs */}
        <div className="flex items-center bg-slate-900/60 border-b border-cyan-500/20 px-2 py-1.5 overflow-x-auto no-scrollbar gap-1 text-xs">
          {[
            { id: 'persona', label: 'PERSONA & IDENTITY', icon: User },
            { id: 'preferences', label: 'VOICE & THEME', icon: Sliders },
            { id: 'habits', label: `LEARNED HABITS (${profile.learnedHabits.length})`, icon: Brain },
            { id: 'privacy', label: 'PRIVACY & DATA', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playAudioFx.click();
                  setActiveTab(tab.id as TabType);
                }}
                className={`px-3 py-1.5 rounded-lg font-tech font-bold text-xs tracking-wider whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs">
          
          {/* TAB 1: PERSONA & IDENTITY */}
          {activeTab === 'persona' && (
            <div className="space-y-3.5">
              {/* User Avatar Selection */}
              <div>
                <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">
                  AVATAR ICON
                </label>
                <div className="flex items-center space-x-2">
                  {AVATAR_ICONS.map((av) => {
                    const Icon = av.icon;
                    const isSelected = profile.avatarIcon === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => {
                          playAudioFx.click();
                          setProfile({ ...profile, avatarIcon: av.id });
                        }}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                        title={av.label}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Calling Name Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1 uppercase tracking-wider">
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="e.g. Kunddan Raj"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 text-slate-100 font-sans text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-tech font-bold text-cyan-400 block mb-1 uppercase tracking-wider flex items-center justify-between">
                    <span>CALLING NAME / SALUTATION</span>
                    <span className="text-[9px] text-slate-400 font-mono-cyber">How Nancy addresses you</span>
                  </label>
                  <input
                    type="text"
                    value={profile.callingName}
                    onChange={(e) => setProfile({ ...profile, callingName: e.target.value })}
                    placeholder="e.g. Boss, Kunddan, Commander"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-cyan-500/40 focus:border-cyan-400 text-cyan-300 font-tech font-bold text-xs outline-none"
                  />
                </div>
              </div>

              {/* Title & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1 uppercase tracking-wider">
                    ROLE / OCCUPATION
                  </label>
                  <input
                    type="text"
                    value={profile.title}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    placeholder="e.g. Lead AI & Hardware Architect"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 text-slate-100 font-sans text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1 uppercase tracking-wider">
                    LOCATION / CITY
                  </label>
                  <input
                    type="text"
                    value={profile.city || ''}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="e.g. New Delhi"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 text-slate-100 font-sans text-xs outline-none"
                  />
                </div>
              </div>

              {/* User Bio */}
              <div>
                <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1 uppercase tracking-wider">
                  PERSONAL BIO & CONTEXT FOR NANCY AI
                </label>
                <textarea
                  rows={2}
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell Nancy about your goals, favorite projects, or working habits..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 text-slate-100 font-sans text-xs outline-none resize-none"
                />
              </div>

              {/* Communication Style */}
              <div>
                <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">
                  NANCY'S COMMUNICATION STYLE
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'tactical', label: 'Tactical (HUD)', desc: 'Concise & technical' },
                    { id: 'concise', label: 'Fast & Direct', desc: 'Minimal words' },
                    { id: 'friendly', label: 'Friendly', desc: 'Warm & conversational' },
                    { id: 'detailed', label: 'Detailed', desc: 'In-depth explanations' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        playAudioFx.click();
                        setProfile({ ...profile, communicationStyle: style.id as any });
                      }}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        profile.communicationStyle === style.id
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-tech font-bold text-[11px] block">{style.label}</span>
                      <span className="text-[9px] text-slate-500 block">{style.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PREFERENCES (LANGUAGE, VOICE & THEME) */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Preferred Language */}
              <div>
                <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1.5 uppercase tracking-wider flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>PRIMARY INTERACTION LANGUAGE</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playAudioFx.click();
                      setProfile({ ...profile, preferredLanguage: 'en' });
                    }}
                    className={`p-2.5 rounded-xl border font-tech font-bold text-xs tracking-wider transition-all flex items-center justify-center space-x-2 ${
                      profile.preferredLanguage === 'en'
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>ENGLISH (EN)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playAudioFx.click();
                      setProfile({ ...profile, preferredLanguage: 'hi' });
                    }}
                    className={`p-2.5 rounded-xl border font-tech font-bold text-xs tracking-wider transition-all flex items-center justify-center space-x-2 ${
                      profile.preferredLanguage === 'hi'
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>HINDI (हिन्दी)</span>
                  </button>
                </div>
              </div>

              {/* Theme Preference */}
              <div>
                <label className="text-[11px] font-tech font-bold text-slate-300 block mb-1.5 uppercase tracking-wider flex items-center space-x-1.5">
                  <Palette className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ACCENT THEME</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THEME_OPTIONS.map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        playAudioFx.click();
                        setProfile({ ...profile, theme: th.id });
                      }}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center space-x-2 ${
                        profile.theme === th.id
                          ? 'bg-slate-800 border-white text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${th.color}`} />
                      <span className="font-tech text-xs">{th.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Sliders */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-tech font-bold text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>NANCY'S VOICE PARAMETERS</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold text-[10px] tracking-wider transition-colors flex items-center space-x-1 shadow-md shadow-cyan-900/30"
                  >
                    <Mic className="w-3 h-3" />
                    <span>TEST VOICE</span>
                  </button>
                </div>

                {/* Voice Model Selector (if voices available) */}
                {availableVoices.length > 0 && (
                  <div>
                    <label className="text-[10px] font-tech text-slate-400 block mb-1">
                      SELECT SYSTEM SYNTHESIS VOICE
                    </label>
                    <select
                      value={profile.selectedVoiceIndex}
                      onChange={(e) => setProfile({ ...profile, selectedVoiceIndex: parseInt(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs outline-none"
                    >
                      {availableVoices.map((v, i) => (
                        <option key={v.voiceURI + i} value={i}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pitch Slider */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono-cyber text-slate-400 mb-1">
                    <span>VOICE PITCH</span>
                    <span className="text-cyan-400">{profile.voicePitch.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={profile.voicePitch}
                    onChange={(e) => setProfile({ ...profile, voicePitch: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Rate Slider */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono-cyber text-slate-400 mb-1">
                    <span>SPEECH RATE / SPEED</span>
                    <span className="text-cyan-400">{profile.voiceRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={profile.voiceRate}
                    onChange={(e) => setProfile({ ...profile, voiceRate: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Volume Slider */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono-cyber text-slate-400 mb-1">
                    <span>SPEECH VOLUME</span>
                    <span className="text-cyan-400">{Math.round(profile.voiceVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={profile.voiceVolume}
                    onChange={(e) => setProfile({ ...profile, voiceVolume: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LEARNED HABITS & AI ADAPTATION */}
          {activeTab === 'habits' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-tech font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Brain className="w-4 h-4 text-cyan-400" />
                    <span>NANCY'S LEARNED HABITS & OBSERVATIONS</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Nancy observes your queries, vision usage, and preferences to automatically personalize responses.
                  </p>
                </div>

                {profile.learnedHabits.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHabits}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-red-500/40 text-red-400 hover:bg-red-950/60 text-[10px] font-tech transition-colors"
                  >
                    CLEAR ALL
                  </button>
                )}
              </div>

              {/* Add Custom Habit Form */}
              <form onSubmit={handleAddCustomHabit} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="text-[10px] font-tech font-bold text-slate-300 block uppercase">
                  TEACH NANCY A NEW HABIT OR RULE
                </span>
                <div className="flex gap-2">
                  <select
                    value={newHabitCategory}
                    onChange={(e) => setNewHabitCategory(e.target.value as any)}
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none"
                  >
                    <option value="topic">Topic</option>
                    <option value="interaction">Interaction</option>
                    <option value="vision">Vision</option>
                    <option value="hardware">Hardware</option>
                    <option value="schedule">Schedule</option>
                  </select>

                  <input
                    type="text"
                    value={newHabitText}
                    onChange={(e) => setNewHabitText(e.target.value)}
                    placeholder="e.g. Always address me as Boss and provide brief answers"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 text-slate-200 text-xs outline-none"
                  />

                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold text-xs tracking-wider transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>TEACH</span>
                  </button>
                </div>
              </form>

              {/* List of Learned Habits */}
              {profile.learnedHabits.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
                  <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-1 animate-pulse" />
                  <p className="text-xs">No learned habits recorded yet.</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    As you chat, detect objects, or toggle hardware, Nancy will continuously record your behavioral patterns.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {profile.learnedHabits.map((habit) => (
                    <div
                      key={habit.id}
                      className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          <span className="text-[9px] font-mono-cyber px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 uppercase">
                            {habit.category}
                          </span>
                          <span className="text-[9px] font-mono-cyber text-slate-500">
                            Count: {habit.detectedCount} • Match: {Math.round(habit.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-slate-200 font-sans text-xs">{habit.observation}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete this habit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DATA MANAGEMENT & PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-tech font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>PRIVACY CONTROLS & DATA RETENTION</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Control what information Nancy AI remembers and stores locally on this device.
                </p>
              </div>

              {/* Privacy Toggles */}
              <div className="space-y-2">
                {[
                  {
                    key: 'allowHabitLearning' as const,
                    title: 'Allow AI Habit Learning',
                    desc: 'Let Nancy adapt tone, voice, and topic focus based on your interactions',
                  },
                  {
                    key: 'saveChatHistory' as const,
                    title: 'Save Chat Conversations',
                    desc: 'Store chat history locally for context across sessions',
                  },
                  {
                    key: 'saveVoiceActivity' as const,
                    title: 'Log Voice Assistant Activity',
                    desc: 'Save voice command transcripts in the Activity Log',
                  },
                  {
                    key: 'saveVisionSnapshots' as const,
                    title: 'Save Vision AI Telemetry',
                    desc: 'Allow saving object recognition snapshots to Memory Vault',
                  },
                  {
                    key: 'incognitoMode' as const,
                    title: 'Incognito / Private Mode',
                    desc: 'Completely disable all activity recording and past memory injection',
                  },
                ].map((item) => {
                  const isChecked = profile.privacy[item.key];
                  return (
                    <div
                      key={item.key}
                      className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="pr-2">
                        <span className="font-tech font-bold text-slate-200 text-xs block">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block">
                          {item.desc}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          playAudioFx.click();
                          setProfile({
                            ...profile,
                            privacy: {
                              ...profile.privacy,
                              [item.key]: !isChecked,
                            },
                          });
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 flex items-center ${
                          isChecked ? 'bg-cyan-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Data Actions: Export and Wipe */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[10px] font-tech font-bold text-slate-400 uppercase tracking-wider block">
                  DATA EXPORT & SYSTEM PURGE
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-tech font-bold text-xs tracking-wider flex items-center justify-center space-x-1.5 transition-colors shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>EXPORT DATA (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowWipeConfirm(true)}
                    className="p-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-tech font-bold text-xs tracking-wider flex items-center justify-center space-x-1.5 transition-colors shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>RESET & WIPE ALL DATA</span>
                  </button>
                </div>

                {/* Wipe Confirmation Modal */}
                {showWipeConfirm && (
                  <div className="p-3 rounded-xl bg-red-950/90 border border-red-500 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center space-x-2 text-red-200">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="font-tech font-bold text-xs">
                        ARE YOU SURE? THIS CANNOT BE UNDONE.
                      </span>
                    </div>
                    <p className="text-[10px] text-red-300">
                      This will permanently erase all saved memories, activity history, and learned habits on this device.
                    </p>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowWipeConfirm(false)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-tech"
                      >
                        CANCEL
                      </button>
                      <button
                        type="button"
                        onClick={handleWipeData}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-tech font-bold text-[10px]"
                      >
                        YES, WIPE EVERYTHING
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-4 py-3 bg-slate-900/90 border-t border-cyan-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400 font-mono-cyber text-[10px]">
            <span>CALLING NAME:</span>
            <span className="text-cyan-300 font-bold">"{profile.callingName || profile.name}"</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                playAudioFx.click();
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-tech text-xs tracking-wider transition-colors"
            >
              CLOSE
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-tech font-bold text-xs tracking-wider transition-all shadow-lg shadow-cyan-500/30 flex items-center space-x-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>SAVE PROFILE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
