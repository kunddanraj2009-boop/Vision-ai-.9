import React, { useState } from 'react';
import {
  Menu,
  MoreVertical,
  Activity,
  Cpu,
  Volume2,
  VolumeX,
  Maximize2,
  Smartphone,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { AssistantState, UserProfile } from '../types/nancy';
import { playAudioFx } from '../services/audioSynth';
import { User } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  assistantState: AssistantState;
  userProfile?: UserProfile;
  onOpenProfile: () => void;
  onOpenMenu: () => void;
  onOpenApkModal: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  assistantState,
  userProfile,
  onOpenProfile,
  onOpenMenu,
  onOpenApkModal,
  onOpenHelp,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setShowMoreMenu(false);
  };

  const handleTestAudio = () => {
    playAudioFx.wakeChime();
    setShowMoreMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#070B14]/85 backdrop-blur-xl border-b border-cyan-500/20 px-4 py-2.5 flex items-center justify-between select-none">
      {/* Brand & Emblem */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onOpenMenu}
          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-cyan-400 active:scale-95 transition-all"
          aria-label="Open Module Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-60" />
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.7)]">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-cyber font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400">
                USE VISION AI
              </h1>
              <span className="text-[9px] font-mono-cyber px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                v2.4
              </span>
            </div>
            <p className="text-[9px] font-tech text-slate-400 tracking-wide">
              MULTIFUNCTIONAL PERSONAL ASSISTANT
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2">
        <PWAInstallButton compact onOpenApkModal={onOpenApkModal} />

        {/* User Profile Badge Button */}
        <button
          onClick={() => {
            playAudioFx.click();
            onOpenProfile();
          }}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 active:scale-95 transition-all shadow-sm group"
          title="Open User Profile & Settings"
        >
          <div className="w-5 h-5 rounded-lg bg-cyan-950 flex items-center justify-center border border-cyan-500/40 text-cyan-400 group-hover:border-cyan-300">
            <User className="w-3 h-3" />
          </div>
          <span className="font-tech font-bold text-xs max-w-[80px] sm:max-w-[120px] truncate">
            {userProfile?.callingName || userProfile?.name || 'Profile'}
          </span>
        </button>

        {/* Core Online Status Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono-cyber">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-slate-300">NEURAL: ACTIVE</span>
        </div>

        {/* More Options dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              playAudioFx.click();
              setShowMoreMenu(!showMoreMenu);
            }}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 active:scale-95 transition-all"
            aria-label="More Options"
          >
            <MoreVertical className="w-4 h-4 text-cyan-400" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#0B132B]/95 border border-cyan-500/30 backdrop-blur-xl shadow-2xl p-1.5 z-50 text-xs">
              <button
                onClick={toggleFullscreen}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-cyan-950/50 text-slate-200 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Toggle Fullscreen</span>
              </button>

              <button
                onClick={handleTestAudio}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-cyan-950/50 text-slate-200 transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test Audio Synth Chime</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenApkModal();
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-cyan-950/50 text-slate-200 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Android WebView / APK</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenHelp();
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-cyan-950/50 text-slate-200 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Voice Commands Guide</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
