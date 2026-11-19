import React, { useState, useEffect } from 'react';
import {
  X,
  HeartPulse,
  Thermometer,
  Droplets,
  Ruler,
  Eye,
  Sun,
  BatteryCharging,
  Radio,
  AlertTriangle,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { SensorData } from '../../types/nancy';
import { playAudioFx } from '../../services/audioSynth';
import { hardwareService } from '../../services/hardwareService';

interface HealthAIModalProps {
  onClose: () => void;
  sensorData: SensorData;
}

export const HealthAIModal: React.FC<HealthAIModalProps> = ({ onClose, sensorData }) => {
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [history, setHistory] = useState<number[]>([25.1, 25.3, 25.4, 25.2, 25.5, 25.4, 25.6]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setHistory((prev) => [...prev.slice(-18), sensorData.temperature]);
  }, [sensorData.temperature]);

  const handleRefreshSensors = async () => {
    setIsRefreshing(true);
    playAudioFx.click();
    try {
      await hardwareService.refreshRealTimeSensors();
      playAudioFx.acknowledge();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const displayTemp = tempUnit === 'C'
    ? `${sensorData.temperature}°C`
    : `${(sensorData.temperature * 1.8 + 32).toFixed(1)}°F`;

  // Compute precise SVG sparkline points
  const minVal = Math.min(...history);
  const maxVal = Math.max(...history, minVal + 0.5);
  const sparklinePoints = history
    .map((val, idx) => {
      const x = ((idx / (history.length - 1 || 1)) * 300).toFixed(1);
      const y = (52 - ((val - minVal) / (maxVal - minVal || 1)) * 40).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2">
            <HeartPulse className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="font-cyber font-bold text-sm text-cyan-300">
                HEALTH AI & REAL-TIME TELEMETRY
              </h2>
              <p className="text-[10px] font-tech text-slate-400">
                ACTIVE SENSORS • STREAMING HUD • {sensorData.lastUpdated}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleRefreshSensors}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 transition-colors"
              title="Force Real-Time Sync"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
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
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs font-sans">
          {/* Operating Mode Ribbon */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-mono-cyber font-bold text-slate-200 text-xs">
                REAL-TIME STREAM: ACTIVE
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`text-[9px] font-mono-cyber px-2.5 py-0.5 rounded-full border ${
                  sensorData.dataSource === 'serial_hardware' || sensorData.dataSource === 'esp32_hardware'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                }`}
              >
                {sensorData.dataSource === 'serial_hardware'
                  ? 'PHYSICAL USB SERIAL BOARD'
                  : sensorData.dataSource === 'esp32_hardware'
                  ? 'PHYSICAL ESP32 WIFI LINK'
                  : 'LIVE REAL HARDWARE & SENSORS'}
              </span>
            </div>
          </div>

          {/* Sparkline Temperature Chart */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span className="font-tech font-bold text-slate-200">
                  Thermal Sensor Dynamic Trend ({displayTemp})
                </span>
              </div>
              <button
                onClick={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                className="px-2 py-0.5 rounded bg-slate-800 font-mono-cyber text-[10px] text-cyan-300 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                Switch to °{tempUnit === 'C' ? 'F' : 'C'}
              </button>
            </div>

            {/* SVG Sparkline with Real Live Points */}
            <div className="h-20 w-full flex items-end pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 300 60">
                <polyline
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              </svg>
            </div>
          </div>

          {/* Sensor Grid */}
          <div className="grid grid-cols-2 gap-2.5 font-mono-cyber">
            {/* Humidity */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-tech font-bold">HUMIDITY</span>
                <Droplets className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xl font-bold text-cyan-300 font-cyber">
                {sensorData.humidity}%
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">RH Optimal Range</span>
            </div>

            {/* Ultrasonic Distance */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-tech font-bold">PROXIMITY (HC-SR04)</span>
                <Ruler className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xl font-bold text-cyan-300 font-cyber">
                {sensorData.distance} cm
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Sonar Distance</span>
            </div>

            {/* Motion PIR */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-tech font-bold">PIR MOTION</span>
                <Eye className={`w-4 h-4 ${sensorData.motionDetected ? 'text-amber-400 animate-ping' : 'text-slate-500'}`} />
              </div>
              <span className={`text-base font-bold font-cyber ${sensorData.motionDetected ? 'text-amber-300' : 'text-slate-300'}`}>
                {sensorData.motionDetected ? 'MOTION DETECTED' : 'CLEAR (NO TARGET)'}
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Passive Infrared</span>
            </div>

            {/* Heart Rate */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-tech font-bold">PULSE BPM</span>
                <HeartPulse className="w-4 h-4 text-rose-400 animate-pulse" />
              </div>
              <span className="text-xl font-bold text-rose-300 font-cyber">
                {sensorData.heartRate} BPM
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Photoplethysmogram</span>
            </div>

            {/* Ambient Light */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-tech font-bold">AMBIENT LUX</span>
                <Sun className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xl font-bold text-amber-300 font-cyber">
                {sensorData.ambientLight} Lux
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">LDR Photocell</span>
            </div>

            {/* Battery Voltage */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-tech font-bold">BATTERY VOLTS</span>
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xl font-bold text-emerald-300 font-cyber">
                {sensorData.voltage} V
              </span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Li-Ion 3.7V Nominal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
