import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(err) {
        console.warn('[PWA] Service worker registration skipped:', err);
      },
    });
  } catch (err) {
    console.warn('[PWA] Service worker setup skipped:', err);
  }
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <h1 className="text-lg font-bold text-cyan-300">USE VISION AI — RECOVERY</h1>
          <p className="text-xs text-slate-400 max-w-md font-mono">
            {this.state.error.message || 'Unexpected runtime error'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs"
          >
            RELOAD APP
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
