import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Cpu, Wifi, Radio } from 'lucide-react';
import { AssistantState, HardwareState, LanguageCode } from '../types/nancy';
import { speechService } from '../services/speechService';
import { playAudioFx } from '../services/audioSynth';

interface AssistantCoreProps {
  assistantState: AssistantState;
  transcript: string;
  isWakeActive: boolean;
  onToggleWake: () => void;
  isAutoAI: boolean;
  onToggleAutoAI: () => void;
  hardwareState: HardwareState;
  language: LanguageCode;
  onToggleLanguage: () => void;
  onQuickCommand: (cmd: string) => void;
}

export const AssistantCore: React.FC<AssistantCoreProps> = ({
  assistantState,
  transcript,
  isWakeActive,
  onToggleWake,
  isAutoAI,
  onToggleAutoAI,
  hardwareState,
  language,
  onToggleLanguage,
  onQuickCommand,
}) => {
  const [audioBars, setAudioBars] = useState<number[]>([15, 25, 40, 20, 30, 50, 35, 20, 10]);

  useEffect(() => {
    let interval: any;
    if (assistantState === 'listening' || assistantState === 'speaking') {
      interval = setInterval(() => {
        setAudioBars([
          Math.floor(Math.random() * 50) + 10,
          Math.floor(Math.random() * 85) + 15,
          Math.floor(Math.random() * 95) + 20,
          Math.floor(Math.random() * 70) + 25,
          Math.floor(Math.random() * 100) + 30,
          Math.floor(Math.random() * 80) + 20,
          Math.floor(Math.random() * 90) + 15,
          Math.floor(Math.random() * 60) + 10,
          Math.floor(Math.random() * 40) + 5,
        ]);
      }, 100);
    } else {
      setAudioBars([12, 18, 24, 16, 28, 20, 25, 15, 10]);
    }
    return () => clearInterval(interval);
  }, [assistantState]);

  const handleMicTap = () => {
    playAudioFx.click();
    if (assistantState === 'speaking') {
      speechService.stopSpeaking();
    } else {
      speechService.toggleListening();
    }
  };

  const getStateColor = () => {
    switch (assistantState) {
      case 'listening':
        return 'from-cyan-400 via-sky-500 to-blue-600 border-cyan-400 shadow-[0_0_35px_rgba(0,240,255,0.6)]';
      case 'processing':
        return 'from-amber-400 via-orange-500 to-cyan-500 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.6)]';
      case 'speaking':
        return 'from-emerald-400 via-teal-500 to-cyan-500 border-teal-400 shadow-[0_0_35px_rgba(20,184,166,0.6)]';
      case 'alert':
        return 'from-red-500 via-rose-600 to-amber-500 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.7)]';
      case 'idle':
      default:
        return 'from-cyan-500/80 via-blue-600/70 to-indigo-900 border-cyan-500/40 shadow-[0_0_25px_rgba(0,112,243,0.35)]';
    }
  };

  const getStatusText = () => {
    switch (assistantState) {
      case 'listening':
        return language === 'hi' ? 'विज़न एआई सुन रही है...' : 'USE VISION AI IS LISTENING...';
      case 'processing':
        return language === 'hi' ? 'न्यूरल प्रोसेसिंग चालू...' : 'NEURAL REASONING ACTIVE...';
      case 'speaking':
        return language === 'hi' ? 'विज़न एआई बोल रही है...' : 'USE VISION AI IS SPEAKING...';
      case 'alert':
        return 'SYSTEM ALERT ACTIVE';
      case 'idle':
      default:
        return isWakeActive ? 'WAKE WORD ARMED ("Hey Vision")' : 'USE VISION AI • SYSTEM READY';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-5 px-4 w-full select-none">
      {/* Assistant Status Sub-Header Bar */}
      <div className="flex items-center justify-between w-full max-w-sm mb-4 px-2 text-xs">
        {/* Hardware Status Badge */}
        <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-700/60 rounded-full px-2.5 py-1 text-slate-300">
          <Radio
            className={`w-3 h-3 ${
              hardwareState.isConnected &&
              (hardwareState.type === 'esp32_wifi' ||
                hardwareState.type === 'serial' ||
                hardwareState.type === 'bluetooth')
                ? 'text-emerald-400 animate-pulse'
                : 'text-slate-500'
            }`}
          />
          <span className="font-mono-cyber text-[10px] tracking-wider">
            {hardwareState.isConnected && hardwareState.type === 'esp32_wifi'
              ? `ESP32 ${hardwareState.deviceIp}`
              : hardwareState.isConnected &&
                (hardwareState.type === 'serial' || hardwareState.type === 'bluetooth')
              ? hardwareState.type.toUpperCase()
              : 'HW STANDBY'}
          </span>
        </div>

        {/* Language Switcher Badge */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center space-x-1 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-full px-2.5 py-1 text-cyan-300 transition-colors"
          title="Switch Voice Language"
        >
          <span className="text-[10px] font-bold font-cyber tracking-wider">
            {language === 'hi' ? 'HINDI (हिन्दी)' : 'ENGLISH (EN)'}
          </span>
        </button>

        {/* Wake Status */}
        <button
          onClick={onToggleWake}
          className={`flex items-center space-x-1 rounded-full px-2.5 py-1 text-[10px] font-mono-cyber transition-all border ${
            isWakeActive
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              : 'bg-slate-900/80 text-slate-400 border-slate-800'
          }`}
          title="Toggle Continuous Wake Word"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isWakeActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
          <span>WAKE: {isWakeActive ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Holographic Arc Reactor AI Core */}
      <div className="relative flex items-center justify-center my-3">
        {/* Outer Rotating Radar Ring */}
        <div className="absolute w-56 h-56 rounded-full border border-cyan-500/15 border-dashed animate-spin-slow pointer-events-none" />

        {/* Intermediate Counter-Rotating Segment Ring */}
        <div className="absolute w-48 h-48 rounded-full border-2 border-t-cyan-400/50 border-r-transparent border-b-blue-500/40 border-l-transparent animate-spin-reverse pointer-events-none" />

        {/* Pulsing Glow Field */}
        <div
          className={`absolute w-40 h-40 rounded-full transition-all duration-700 blur-xl opacity-60 ${
            assistantState === 'listening'
              ? 'bg-cyan-400 animate-pulse'
              : assistantState === 'speaking'
              ? 'bg-teal-400'
              : assistantState === 'alert'
              ? 'bg-red-500'
              : 'bg-blue-600'
          }`}
        />

        {/* Central Clickable AI Reactor Core */}
        <button
          onClick={handleMicTap}
          aria-label="Activate Vision AI Voice Core"
          className={`relative z-10 w-36 h-36 rounded-full bg-gradient-to-tr ${getStateColor()} border-2 flex flex-col items-center justify-center transition-all duration-500 cursor-pointer active:scale-95 group focus:outline-none`}
        >
          {/* Inner Core Glass Circle */}
          <div className="w-28 h-28 rounded-full bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center border border-white/20 shadow-inner">
            {assistantState === 'speaking' ? (
              <div className="flex items-center space-x-1">
                {audioBars.map((h, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${h * 0.28}px` }}
                    className="w-1 bg-gradient-to-t from-cyan-400 to-teal-200 rounded-full transition-all duration-75"
                  />
                ))}
              </div>
            ) : assistantState === 'listening' ? (
              <div className="flex flex-col items-center">
                <Mic className="w-8 h-8 text-cyan-300 animate-bounce" />
                <span className="text-[9px] font-mono-cyber text-cyan-400 uppercase tracking-widest mt-1">
                  Listening
                </span>
              </div>
            ) : assistantState === 'processing' ? (
              <div className="flex flex-col items-center">
                <Sparkles className="w-8 h-8 text-amber-300 animate-spin" />
                <span className="text-[9px] font-mono-cyber text-amber-300 uppercase tracking-widest mt-1">
                  Reasoning
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Cpu className="w-8 h-8 text-cyan-400 group-hover:text-cyan-200 transition-colors" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                </div>
                <span className="text-[9px] font-cyber font-bold text-white tracking-widest mt-1">
                  VISION AI
                </span>
                <span className="text-[8px] font-mono-cyber text-cyan-400/80 uppercase">
                  TAP TO SPEAK
                </span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* State Status Banner */}
      <div className="flex items-center space-x-2 mt-2 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/20 shadow-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            assistantState === 'listening'
              ? 'bg-cyan-400 animate-ping'
              : assistantState === 'speaking'
              ? 'bg-teal-400 animate-pulse'
              : assistantState === 'processing'
              ? 'bg-amber-400 animate-spin'
              : 'bg-blue-400'
          }`}
        />
        <span className="text-[11px] font-mono-cyber font-semibold tracking-wider text-cyan-300">
          {getStatusText()}
        </span>
      </div>

      {/* Live Voice Transcript Box */}
      <div className="w-full max-w-md min-h-[44px] mt-3 px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex items-center justify-center text-center">
        {transcript ? (
          <p className="text-sm font-sans text-slate-200 italic line-clamp-2">
            "{transcript}"
          </p>
        ) : (
          <p className="text-xs text-slate-500 font-mono-cyber">
            {language === 'hi'
              ? 'आवाज़ से कुछ भी कहें या नीचे दिए गए मॉड्यूल खोलें...'
              : 'Say a voice command or tap any module below...'}
          </p>
        )}
      </div>

      {/* Quick Voice Command Pills */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-sm px-2">
        <button
          onClick={() => onQuickCommand(language === 'hi' ? 'सामने क्या ऑब्जेक्ट है जैसे इंसान वाहन टेबल?' : 'What objects are visible like human vehicle table?')}
          className="text-[10px] font-tech px-2.5 py-1 rounded-md bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 transition-colors cursor-pointer shadow-sm"
        >
          {language === 'hi' ? '🎯 ऑब्जेक्ट्स पहचानो' : '🎯 Detect Objects'}
        </button>
        <button
          onClick={() => onQuickCommand(language === 'hi' ? 'लाइव रियल टाइम सेंसर डेटा बताओ' : 'Report live sensor telemetry')}
          className="text-[10px] font-tech px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:border-cyan-500/50 transition-colors cursor-pointer"
        >
          {language === 'hi' ? '📡 रियल-टाइम डेटा' : '📡 Real-time Data'}
        </button>
        <button
          onClick={() => onQuickCommand(language === 'hi' ? 'कैमरा विज़न चालू करो' : 'Open Vision AI')}
          className="text-[10px] font-tech px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:border-cyan-500/50 transition-colors cursor-pointer"
        >
          {language === 'hi' ? '👁️ विज़न AI' : '👁️ Vision AI'}
        </button>
        <button
          onClick={() => onQuickCommand(language === 'hi' ? 'एलईडी लाइट चालू करो' : 'Turn on LED Light')}
          className="text-[10px] font-tech px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:border-cyan-500/50 transition-colors cursor-pointer"
        >
          {language === 'hi' ? '💡 लाइट चालू' : '💡 Toggle LED'}
        </button>
      </div>
    </div>
  );
};
