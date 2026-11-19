import React from 'react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 z-50 flex items-center space-x-2 rounded-xl bg-amber-500/95 px-3 py-1.5 text-[11px] font-tech font-bold text-black shadow-lg">
      <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
      <span>OFFLINE MODE — CACHED APP ACTIVE</span>
    </div>
  );
};
