import React, { useState, useEffect } from 'react';
import {
  X,
  AlertOctagon,
  AlertTriangle,
  Info,
  Bell,
  Trash2,
  Volume2,
  CheckCircle,
} from 'lucide-react';
import { NancyAlert } from '../../types/nancy';
import { storageService } from '../../services/storageService';
import { playAudioFx } from '../../services/audioSynth';

interface AlertsModalProps {
  onClose: () => void;
  onClearCount: () => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({ onClose, onClearCount }) => {
  const [alerts, setAlerts] = useState<NancyAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [notificationStatus, setNotificationStatus] = useState<string>('default');

  useEffect(() => {
    const list = storageService.getAlerts();
    setAlerts(list);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationStatus(perm);
      if (perm === 'granted') {
        new Notification('USE VISION AI', {
          body: 'System notifications permission granted.',
          icon: '/icon.svg',
        });
      }
    }
  };

  const handleTestSiren = () => {
    playAudioFx.alertSiren();
  };

  const handleClearAlerts = () => {
    playAudioFx.click();
    setAlerts([]);
    storageService.saveAlerts([]);
    onClearCount();
  };

  const filtered = alerts.filter((a) => {
    if (filter === 'all') return true;
    return a.severity === filter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" />
            <div>
              <h2 className="font-cyber font-bold text-sm text-cyan-300">
                SYSTEM & HARDWARE ALERTS
              </h2>
              <p className="text-[10px] font-tech text-slate-400">
                CRITICAL THRESHOLDS • INTRUDER WARNINGS • NOTIFICATIONS
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

        {/* Body Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs font-sans">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono-cyber text-[10px]">
              {(['all', 'critical', 'warning', 'info'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilter(lvl)}
                  className={`px-2 py-0.5 rounded capitalize ${
                    filter === lvl
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleTestSiren}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-tech flex items-center space-x-1"
                title="Test Siren Audio"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>SIREN TEST</span>
              </button>
              {alerts.length > 0 && (
                <button
                  onClick={handleClearAlerts}
                  className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300"
                  title="Clear All Alerts"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Web Notifications Permission Box */}
          {notificationStatus !== 'granted' && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-tech font-bold text-slate-200 block">
                  Push / System Notifications
                </span>
                <span className="text-[10px] text-slate-400">
                  Allow USE VISION AI to dispatch hardware alerts when minimized.
                </span>
              </div>
              <button
                onClick={requestNotificationPermission}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold"
              >
                ENABLE
              </button>
            </div>
          )}

          {/* Alerts Feed */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-slate-500">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1 opacity-70" />
                <p className="font-tech text-slate-300">No active alerts</p>
                <p className="text-[10px] text-slate-500">All hardware and sensor telemetrics nominal.</p>
              </div>
            ) : (
              filtered.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border flex items-start space-x-3 transition-colors ${
                    a.severity === 'critical'
                      ? 'bg-red-950/40 border-red-500/40'
                      : a.severity === 'warning'
                      ? 'bg-amber-950/40 border-amber-500/40'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  {a.severity === 'critical' ? (
                    <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : a.severity === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-tech font-bold text-slate-200 text-xs">
                        {a.title}
                      </span>
                      <span className="font-mono-cyber text-[10px] text-slate-400">
                        {a.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 font-sans">
                      {a.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
