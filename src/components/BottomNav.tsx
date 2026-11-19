import React from 'react';
import { Home, MessageSquare, Activity, Settings } from 'lucide-react';
import { playAudioFx } from '../services/audioSynth';

export type NavTab = 'home' | 'chat' | 'data' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadAlertCount: number;
  isControllerConnected?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  unreadAlertCount,
  isControllerConnected = false,
}) => {
  const handleTabClick = (tab: NavTab) => {
    playAudioFx.click();
    onSelectTab(tab);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070B14]/90 backdrop-blur-xl border-t border-cyan-500/20 px-3 py-2 pb-safe select-none">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* 1. HOME */}
        <button
          onClick={() => handleTabClick('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
            currentTab === 'home' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className={`w-5 h-5 ${currentTab === 'home' ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : ''}`} />
          <span className="text-[10px] font-cyber font-semibold tracking-wider mt-1">
            HOME
          </span>
          {currentTab === 'home' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#00F0FF]" />
          )}
        </button>

        {/* 2. CHAT */}
        <button
          onClick={() => handleTabClick('chat')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
            currentTab === 'chat' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${currentTab === 'chat' ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : ''}`} />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-cyber font-semibold tracking-wider mt-1">
            CHAT
          </span>
          {currentTab === 'chat' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#00F0FF]" />
          )}
        </button>

        {/* 3. DATA DISPLAY (right next to CHAT) */}
        <button
          onClick={() => handleTabClick('data')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
            currentTab === 'data' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Activity className={`w-5 h-5 ${currentTab === 'data' ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : ''}`} />
            {isControllerConnected && (
              <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-cyber font-semibold tracking-wider mt-1">
            DATA
          </span>
          {currentTab === 'data' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#00F0FF]" />
          )}
        </button>

        {/* 4. SETTINGS */}
        <button
          onClick={() => handleTabClick('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
            currentTab === 'settings' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className={`w-5 h-5 ${currentTab === 'settings' ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : ''}`} />
          <span className="text-[10px] font-cyber font-semibold tracking-wider mt-1">
            SETTINGS
          </span>
          {currentTab === 'settings' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#00F0FF]" />
          )}
        </button>
      </div>
    </nav>
  );
};
