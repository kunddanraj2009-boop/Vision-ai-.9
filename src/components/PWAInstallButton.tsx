import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { playAudioFx } from '../services/audioSynth';

interface PWAInstallButtonProps {
  compact?: boolean;
  onOpenApkModal?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  onOpenApkModal,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={() => {
          playAudioFx.click();
          void install();
        }}
        className={
          compact
            ? 'flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-tech font-bold text-[11px] active:scale-95 transition-all'
            : 'w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-tech font-bold text-xs tracking-wider shadow-lg shadow-emerald-500/25 active:scale-95 transition-all'
        }
        title="Install USE VISION AI on Android / Desktop"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{compact ? 'INSTALL' : 'INSTALL APP ON ANDROID (1-TAP)'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => {
            playAudioFx.click();
            setShowIOSGuide(true);
          }}
          className={
            compact
              ? 'flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-tech font-bold text-[11px] transition-all'
              : 'w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-tech font-bold text-xs tracking-wider transition-all'
          }
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{compact ? 'APP' : 'INSTALL ON IPHONE / IPAD'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0B132B] border border-cyan-500/40 p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-cyber font-bold text-sm text-cyan-300">
                  INSTALL ON IPHONE / IPAD
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                1. Safari toolbar mein <strong className="text-cyan-300">Share</strong> icon par tap karein.
                <br />
                2. Neeche scroll karke <strong className="text-cyan-300">Add to Home Screen</strong> select karein.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black py-2 text-xs font-tech font-bold"
              >
                OK, GOT IT
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (onOpenApkModal) {
    return (
      <button
        onClick={() => {
          playAudioFx.click();
          onOpenApkModal();
        }}
        className={
          compact
            ? 'flex items-center space-x-1 px-2 py-1 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-300 font-tech font-bold text-[10px] active:scale-95 transition-all'
            : 'w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-tech font-bold text-xs tracking-wider transition-all'
        }
        title="Android APK Export & App Install"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>{compact ? 'APK' : 'ANDROID APK / INSTALL'}</span>
      </button>
    );
  }

  return null;
};
