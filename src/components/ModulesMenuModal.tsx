import React from 'react';
import {
  X,
  Radio,
  Eye,
  UserCheck,
  Hand,
  HeartPulse,
  Bell,
} from 'lucide-react';
import { playAudioFx } from '../services/audioSynth';

export type ActiveModule =
  | 'hardware_hub'
  | 'vision_ai'
  | 'face_intelligence'
  | 'gesture_ai'
  | 'health_ai'
  | 'alerts'
  | null;

interface ModulesMenuModalProps {
  onClose: () => void;
  onSelectModule: (module: ActiveModule) => void;
  unreadAlertCount: number;
}

export const ModulesMenuModal: React.FC<ModulesMenuModalProps> = ({
  onClose,
  onSelectModule,
  unreadAlertCount,
}) => {
  const modules = [
    {
      id: 'hardware_hub' as const,
      name: 'Hardware Hub',
      desc: 'ESP32, BLE, Serial & Relays',
      icon: <Radio className="w-5 h-5 text-cyan-400" />,
      tag: 'IoT Core',
      color: 'from-cyan-950/70 to-blue-950/60 border-cyan-500/30',
    },
    {
      id: 'vision_ai' as const,
      name: 'Vision AI',
      desc: 'Real-time Object Tracker & HUD',
      icon: <Eye className="w-5 h-5 text-teal-400" />,
      tag: 'Vision',
      color: 'from-teal-950/70 to-slate-950/60 border-teal-500/30',
    },
    {
      id: 'face_intelligence' as const,
      name: 'Face Intelligence',
      desc: 'Biometrics & Enrollment',
      icon: <UserCheck className="w-5 h-5 text-sky-400" />,
      tag: 'Biometrics',
      color: 'from-sky-950/70 to-slate-950/60 border-sky-500/30',
    },
    {
      id: 'gesture_ai' as const,
      name: 'Gesture AI',
      desc: '21-Joint MediaPipe Control',
      icon: <Hand className="w-5 h-5 text-amber-400" />,
      tag: 'Touchless',
      color: 'from-amber-950/60 to-slate-950/60 border-amber-500/30',
    },
    {
      id: 'health_ai' as const,
      name: 'Health AI',
      desc: 'Sensor Telemetry & Trends',
      icon: <HeartPulse className="w-5 h-5 text-rose-400" />,
      tag: 'Sensors',
      color: 'from-rose-950/60 to-slate-950/60 border-rose-500/30',
    },
    {
      id: 'alerts' as const,
      name: 'Alerts',
      desc: 'Threshold Warnings & Siren',
      icon: <Bell className="w-5 h-5 text-red-400" />,
      tag: unreadAlertCount > 0 ? `${unreadAlertCount} Alert` : 'Shield',
      color: 'from-red-950/60 to-slate-950/60 border-red-500/30',
    },
  ];

  const handleSelect = (id: ActiveModule) => {
    playAudioFx.click();
    onSelectModule(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div>
            <h2 className="font-cyber font-bold text-sm text-cyan-300">
              USE VISION AI MODULAR ARCHITECTURE
            </h2>
            <p className="text-[10px] font-tech text-slate-400">
              {modules.length} INDEPENDENT INTERACTIVE SUBSYSTEMS
            </p>
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

        {/* Modules Grid */}
        <div className="p-3.5 overflow-y-auto flex-1 grid grid-cols-2 gap-2.5">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              className={`p-3 rounded-xl bg-gradient-to-br ${m.color} border text-left flex flex-col justify-between hover:scale-[1.02] active:scale-95 transition-all shadow-md group`}
            >
              <div className="flex items-start justify-between w-full">
                <div className="p-2 rounded-lg bg-slate-950/80 border border-white/10 group-hover:border-cyan-400/50 transition-colors">
                  {m.icon}
                </div>
                <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-black/60 text-slate-300 border border-white/10">
                  {m.tag}
                </span>
              </div>

              <div className="mt-2.5">
                <span className="font-tech font-bold text-slate-100 text-xs block group-hover:text-cyan-300 transition-colors">
                  {m.name}
                </span>
                <span className="text-[10px] text-slate-400 font-sans line-clamp-1 block">
                  {m.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
