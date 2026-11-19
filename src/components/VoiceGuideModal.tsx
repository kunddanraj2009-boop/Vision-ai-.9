import React from 'react';
import { X, HelpCircle, Mic, Volume2 } from 'lucide-react';
import { playAudioFx } from '../services/audioSynth';
import { speechService } from '../services/speechService';

interface VoiceGuideModalProps {
  onClose: () => void;
  onExecuteCommand: (cmd: string) => void;
}

export const VoiceGuideModal: React.FC<VoiceGuideModalProps> = ({
  onClose,
  onExecuteCommand,
}) => {
  const commands = [
    { text: 'Turn on LED Light', desc: 'Toggles relay 1 on connected hardware' },
    { text: 'Check temperature and humidity', desc: 'Speaks sensor telemetry status' },
    { text: 'Open vision AI', desc: 'Launches real-time camera object tracker' },
    { text: 'Scan face biometric', desc: 'Verifies enrolled face profiles' },
    { text: 'Who are you?', desc: 'USE VISION AI introduces capabilities' },
    { text: 'Beep alarm siren', desc: 'Triggers buzzer & cybernetic alarm sound' },
    { text: 'सुनो विज़न, लाइट चालू करो', desc: 'Hindi: Toggles relay switch' },
    { text: 'तापमान कितना है?', desc: 'Hindi: Reports sensor temperature' },
  ];

  const handleTest = (cmd: string) => {
    playAudioFx.click();
    onClose();
    onExecuteCommand(cmd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <h2 className="font-cyber font-bold text-sm text-cyan-300">
                VOICE COMMAND GUIDE
              </h2>
              <p className="text-[10px] font-tech text-slate-400">
                ENGLISH & HINDI VOICE SYNTAX FOR USE VISION AI
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

        {/* Content */}
        <div className="p-4 space-y-2 flex-1 overflow-y-auto text-xs font-sans">
          <p className="text-slate-400 text-[11px] mb-2">
            Tap any command below to test it immediately or speak it via the central voice core:
          </p>

          <div className="space-y-2">
            {commands.map((c, i) => (
              <button
                key={i}
                onClick={() => handleTest(c.text)}
                className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left flex items-center justify-between transition-colors group"
              >
                <div>
                  <span className="font-mono-cyber font-bold text-cyan-300 text-xs block group-hover:text-cyan-200">
                    "{c.text}"
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    {c.desc}
                  </span>
                </div>
                <Mic className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
