import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Hand,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertTriangle,
  Camera,
  Zap,
} from 'lucide-react';
import { playAudioFx } from '../../services/audioSynth';
import { speechService } from '../../services/speechService';
import { hardwareService } from '../../services/hardwareService';
import {
  gestureService,
  GestureType,
  DetectedHandResult,
  GESTURE_SIGN_INFO,
  HAND_CONNECTIONS,
} from '../../services/gestureService';

interface GestureAIModalProps {
  onClose: () => void;
  language: 'en' | 'hi';
}

const ALL_GESTURE_LIST = Object.values(GESTURE_SIGN_INFO);

export const GestureAIModal: React.FC<GestureAIModalProps> = ({ onClose, language }) => {
  const [activeGesture, setActiveGesture] = useState<GestureType | null>(null);
  const [gestureConfidence, setGestureConfidence] = useState<number>(0);
  const [handsDetectedCount, setHandsDetectedCount] = useState<number>(0);
  const [gestureLogs, setGestureLogs] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>(() =>
    gestureService.isReady() ? 'ready' : 'loading'
  );
  const [modelErrorMsg, setModelErrorMsg] = useState<string | null>(null);
  const [delegateName, setDelegateName] = useState<string>(() => gestureService.getDelegate());
  const [autoTriggerEnabled, setAutoTriggerEnabled] = useState<boolean>(true);
  const [voiceSpeakEnabled, setVoiceSpeakEnabled] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);

  const facingModeRef = useRef<'user' | 'environment'>(facingMode);
  const autoTriggerRef = useRef<boolean>(autoTriggerEnabled);
  const voiceSpeakRef = useRef<boolean>(voiceSpeakEnabled);
  const languageRef = useRef<'en' | 'hi'>(language);
  const lastFrameDetectRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(Date.now());
  const stableGestureRef = useRef<{ type: GestureType | null; streak: number }>({ type: null, streak: 0 });
  const lastSpokenGestureRef = useRef<{ type: GestureType | null; time: number }>({ type: null, time: 0 });
  const lastTriggeredRef = useRef<{ type: GestureType | null; time: number }>({ type: null, time: 0 });

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  useEffect(() => {
    autoTriggerRef.current = autoTriggerEnabled;
  }, [autoTriggerEnabled]);

  useEffect(() => {
    voiceSpeakRef.current = voiceSpeakEnabled;
  }, [voiceSpeakEnabled]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // 1. Initialize real MediaPipe Gesture Recognizer
  const initGestureModel = async (forceReload = false) => {
    setModelStatus('loading');
    setModelErrorMsg(null);
    const model = await gestureService.initialize(forceReload);
    if (model) {
      setModelStatus('ready');
      setDelegateName(gestureService.getDelegate());
      setModelErrorMsg(null);
    } else {
      setModelStatus('error');
      setModelErrorMsg(gestureService.getLastError() || 'Failed to initialize MediaPipe model.');
    }
  };

  useEffect(() => {
    initGestureModel(false);
  }, []);

  // 2. Real Camera Stream Lifecycle
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActiveStream(null);
  };

  const startCamera = async (mode = facingMode) => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera MediaDevices API is not supported in this browser.');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setActiveStream(stream);
      playAudioFx.scannerPing();
    } catch (err: any) {
      setCameraError(err?.message || 'Camera permission denied or camera unavailable.');
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (activeStream && video) {
      if (video.srcObject !== activeStream) {
        video.srcObject = activeStream;
      }
      const tryPlay = () => {
        video.play().catch((e) => console.warn('Gesture video play error:', e));
      };
      if (video.readyState >= 1) {
        tryPlay();
      } else {
        video.onloadedmetadata = tryPlay;
      }
    }
  }, [activeStream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [facingMode]);

  // 3. Speak sign meaning + execute optional mapped control action
  const announceSignAndExecute = (
    gesture: GestureType,
    options: { isAuto?: boolean; speakMeaning?: boolean; runAction?: boolean } = {}
  ) => {
    const { isAuto = false, speakMeaning = true, runAction = true } = options;
    const info = GESTURE_SIGN_INFO[gesture];
    const lang = languageRef.current;
    const time = new Date().toLocaleTimeString();

    playAudioFx.acknowledge();

    if (speakMeaning) {
      const spokenText = lang === 'hi' ? info.spokenHi : info.spokenEn;
      speechService.speak(spokenText);
    }

    let actionNote = '';
    if (runAction) {
      switch (gesture) {
        case 'thumbs_up':
          playAudioFx.wakeChime();
          break;
        case 'open_palm':
          if (!speakMeaning) {
            speechService.stopSpeaking();
            actionNote = lang === 'hi' ? ' • आवाज़ रोकी गई' : ' • Speech Paused';
          }
          break;
        case 'fist':
          speechService.stopListening();
          actionNote = lang === 'hi' ? ' • माइक म्यूट' : ' • Mic Muted';
          break;
        case 'pointing':
          hardwareService.toggleRelay(0);
          actionNote = lang === 'hi' ? ' • रिले टॉगल' : ' • Relay Toggled';
          break;
        default:
          break;
      }
    }

    const label = lang === 'hi' ? info.labelHi : info.labelEn;
    const meaning = lang === 'hi' ? info.meaningHi : info.meaningEn;
    const prefix = isAuto ? '[AUTO] ' : '';
    setGestureLogs((prev) => [
      `[${time}] ${prefix}${info.emoji} ${label} — ${meaning}${actionNote}`,
      ...prev.slice(0, 20),
    ]);
  };

  // 4. Real-Time MediaPipe 21-Joint Hand Tracking Loop
  useEffect(() => {
    let isRunning = true;

    const drawHandsOverlay = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      hands: DetectedHandResult[],
      isMirrored: boolean
    ) => {
      ctx.save();
      if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      hands.forEach((hand) => {
        const lms = hand.landmarks;
        if (!lms || lms.length < 21) return;

        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        const pts = lms.map((lm) => {
          const px = lm.x * width;
          const py = lm.y * height;
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
          return { x: px, y: py };
        });

        const pad = 16;
        const bx = Math.max(4, minX - pad);
        const by = Math.max(4, minY - pad);
        const bw = Math.min(width - bx - 4, maxX - minX + pad * 2);
        const bh = Math.min(height - by - 4, maxY - minY + pad * 2);

        ctx.strokeStyle = hand.gesture ? 'rgba(16, 185, 129, 0.75)' : 'rgba(0, 240, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
          const p1 = pts[startIdx];
          const p2 = pts[endIdx];
          if (p1 && p2) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
        });
        ctx.stroke();

        const tipIndices = new Set([4, 8, 12, 16, 20]);
        pts.forEach((pt, idx) => {
          const isTip = tipIndices.has(idx);
          const isWrist = idx === 0;
          ctx.fillStyle = isTip ? '#10B981' : isWrist ? '#F59E0B' : '#22D3EE';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isTip ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        const signMeta = hand.gesture ? GESTURE_SIGN_INFO[hand.gesture] : null;
        const signTitle = signMeta
          ? `${signMeta.labelEn.toUpperCase()} (${Math.round(hand.confidence * 100)}%)`
          : 'TRACKING';
        const labelText = `${hand.handedness.toUpperCase()} • ${signTitle}`;

        ctx.save();
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(labelText).width;
        const plateW = tw + 14;
        const plateH = 22;
        const plateY = Math.max(0, by - plateH - 2);
        const plateX = Math.max(4, Math.min(width - plateW - 4, bx));

        if (isMirrored) {
          ctx.translate(plateX + plateW / 2, plateY + plateH / 2);
          ctx.scale(-1, 1);
          ctx.translate(-(plateX + plateW / 2), -(plateY + plateH / 2));
        }

        ctx.fillStyle = 'rgba(7, 11, 20, 0.9)';
        ctx.fillRect(plateX, plateY, plateW, plateH);
        ctx.fillStyle = hand.gesture ? '#10B981' : '#00F0FF';
        ctx.fillRect(plateX, plateY, 3, plateH);
        ctx.fillStyle = hand.gesture ? '#34D399' : '#22D3EE';
        ctx.fillText(labelText, plateX + 8, plateY + 15);
        ctx.restore();
      });

      ctx.restore();
    };

    const runLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const now = Date.now();

      frameCounterRef.current++;
      if (now - fpsTimerRef.current >= 1000) {
        setFps(frameCounterRef.current);
        frameCounterRef.current = 0;
        fpsTimerRef.current = now;
      }

      if (
        canvas &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, vw, vh);

          if (gestureService.isReady() && now - lastFrameDetectRef.current >= 33) {
            lastFrameDetectRef.current = now;
            const hands = gestureService.detectVideoFrame(video);
            setHandsDetectedCount(hands.length);

            if (hands.length > 0) {
              drawHandsOverlay(ctx, vw, vh, hands, facingModeRef.current === 'user');
              const primaryWithGesture = hands.find((h) => h.gesture !== null) || hands[0];

              if (primaryWithGesture.gesture) {
                const g = primaryWithGesture.gesture;
                setActiveGesture(g);
                setGestureConfidence(Math.round(primaryWithGesture.confidence * 100));

                if (stableGestureRef.current.type === g) {
                  stableGestureRef.current.streak += 1;
                } else {
                  stableGestureRef.current = { type: g, streak: 1 };
                }

                // Speak sign + meaning and/or trigger action once held for 4 frames
                if (stableGestureRef.current.streak === 4) {
                  const shouldSpeakNow =
                    voiceSpeakRef.current &&
                    (lastSpokenGestureRef.current.type !== g ||
                      now - lastSpokenGestureRef.current.time > 4500);
                  const shouldRunAction =
                    autoTriggerRef.current &&
                    (lastTriggeredRef.current.type !== g ||
                      now - lastTriggeredRef.current.time > 3500);

                  if (shouldSpeakNow || shouldRunAction) {
                    if (shouldSpeakNow) {
                      lastSpokenGestureRef.current = { type: g, time: now };
                    }
                    if (shouldRunAction) {
                      lastTriggeredRef.current = { type: g, time: now };
                    }
                    announceSignAndExecute(g, {
                      isAuto: true,
                      speakMeaning: shouldSpeakNow,
                      runAction: shouldRunAction,
                    });
                  }
                }
              } else {
                setActiveGesture(null);
                setGestureConfidence(0);
                stableGestureRef.current = { type: null, streak: 0 };
              }
            } else {
              setActiveGesture(null);
              setGestureConfidence(0);
              stableGestureRef.current = { type: null, streak: 0 };
            }
          }
        }
      }

      loopRef.current = requestAnimationFrame(runLoop);
    };

    loopRef.current = requestAnimationFrame(runLoop);
    return () => {
      isRunning = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  const activeSignMeta = activeGesture ? GESTURE_SIGN_INFO[activeGesture] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl bg-slate-950/95">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2 min-w-0">
            <Hand className="w-5 h-5 text-cyan-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="font-cyber font-bold text-sm text-cyan-300">
                  GESTURE AI (SIGN MEANING)
                </h2>
                {modelStatus === 'ready' ? (
                  <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                    LIVE • {delegateName}
                  </span>
                ) : modelStatus === 'loading' ? (
                  <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse">
                    LOADING MODEL...
                  </span>
                ) : (
                  <button
                    onClick={() => initGestureModel(true)}
                    className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 hover:bg-red-900"
                  >
                    ERROR • RETRY
                  </button>
                )}
              </div>
              <p className="text-[10px] font-tech text-slate-400 truncate">
                21-JOINT HAND TRACKING • SPEAKS SIGN MEANING ALOUD
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => {
                playAudioFx.click();
                setVoiceSpeakEnabled((prev) => {
                  const next = !prev;
                  if (!next) speechService.stopSpeaking();
                  return next;
                });
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors ${
                voiceSpeakEnabled
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800/70 border-slate-700 text-slate-400'
              }`}
              title="Toggle speaking detected hand sign meaning aloud"
            >
              {voiceSpeakEnabled ? (
                <Volume2 className="w-3 h-3" />
              ) : (
                <VolumeX className="w-3 h-3" />
              )}
              <span>VOICE</span>
            </button>

            <button
              onClick={() => {
                playAudioFx.click();
                setAutoTriggerEnabled(!autoTriggerEnabled);
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors ${
                autoTriggerEnabled
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800/70 border-slate-700 text-slate-400'
              }`}
              title="Automatically run mapped hardware/system actions on gesture"
            >
              <Zap className="w-3 h-3" />
              <span>AUTO</span>
            </button>

            <button
              onClick={() => {
                playAudioFx.click();
                speechService.stopSpeaking();
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-cyan-500/20">
          {cameraError ? (
            <div className="p-5 text-center space-y-2 max-w-xs">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-200">Camera Access Unavailable</p>
              <p className="text-[11px] text-slate-400">{cameraError}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech text-xs inline-flex items-center space-x-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>RETRY CAMERA</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />

              {modelStatus === 'loading' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-xs pointer-events-none">
                  <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mb-2" />
                  <p className="text-xs font-cyber text-cyan-300 tracking-wider">
                    {language === 'hi' ? '21-जॉइंट हैंड ट्रैकर लोड हो रहा है...' : 'LOADING 21-JOINT HAND TRACKER...'}
                  </p>
                </div>
              )}

              {modelStatus === 'error' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-center">
                  <AlertTriangle className="w-7 h-7 text-amber-400 mb-2" />
                  <p className="text-xs font-cyber text-amber-300">MEDIAPIPE FAILED TO LOAD</p>
                  {modelErrorMsg && <p className="text-[10px] text-slate-400 mt-1 max-w-xs">{modelErrorMsg}</p>}
                  <button
                    onClick={() => initGestureModel(true)}
                    className="mt-2.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech text-xs flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>RETRY LOAD</span>
                  </button>
                </div>
              )}

              {/* Live Telemetry Overlay */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
                <div className="bg-black/85 backdrop-blur-md px-2.5 py-1 rounded border border-cyan-500/30 text-[10px] font-mono-cyber text-cyan-300 flex items-center space-x-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      handsDetectedCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'
                    }`}
                  />
                  <span>
                    {activeSignMeta
                      ? `${activeSignMeta.emoji} ${(language === 'hi' ? activeSignMeta.labelHi : activeSignMeta.labelEn).toUpperCase()} (${gestureConfidence}%)`
                      : handsDetectedCount > 0
                      ? `HAND TRACKED (${handsDetectedCount}) • SHOW SIGN`
                      : modelStatus === 'ready'
                      ? 'SHOW HAND SIGN IN CAMERA...'
                      : 'INITIALIZING...'}
                  </span>
                </div>

                <span className="bg-black/80 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-mono-cyber text-slate-300">
                  {fps} FPS
                </span>
              </div>

              {/* Flip Camera Button */}
              <button
                onClick={() => {
                  playAudioFx.click();
                  setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
                }}
                className="absolute bottom-2 right-2 p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 backdrop-blur-md z-10"
                title="Switch Front/Rear Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto text-xs">
          {/* Live Detected Sign Meaning Banner */}
          <div
            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
              activeSignMeta
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            {activeSignMeta ? (
              <>
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="text-2xl shrink-0">{activeSignMeta.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-tech font-bold text-emerald-300 text-xs flex items-center space-x-2">
                      <span>{language === 'hi' ? activeSignMeta.labelHi : activeSignMeta.labelEn}</span>
                      <span className="text-[10px] font-mono-cyber text-emerald-400">
                        {gestureConfidence}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 font-medium truncate">
                      {language === 'hi'
                        ? `मतलब: ${activeSignMeta.meaningHi}`
                        : `Meaning: ${activeSignMeta.meaningEn}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    announceSignAndExecute(activeSignMeta.id, {
                      isAuto: false,
                      speakMeaning: true,
                      runAction: false,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/50 text-emerald-200 font-mono-cyber text-[10px] flex items-center space-x-1 shrink-0"
                  title="Speak sign meaning again"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>SPEAK</span>
                </button>
              </>
            ) : (
              <div className="text-[11px] font-mono-cyber text-slate-400">
                {language === 'hi'
                  ? 'कैमरे के सामने कोई हैंड साइन दिखाएँ — पहचान होते ही उसका नाम और मतलब बोला जाएगा।'
                  : 'Show any hand sign in camera view — detected sign and its meaning will be spoken aloud.'}
              </div>
            )}
          </div>

          {/* Supported Hand Signs & Meanings Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-tech font-bold text-cyan-300 text-xs tracking-wider">
                SUPPORTED SIGNS & MEANINGS ({ALL_GESTURE_LIST.length})
              </span>
              <span className="text-[10px] font-mono-cyber text-slate-400">
                SHOW SIGN OR TAP TO SPEAK
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_GESTURE_LIST.map((item) => {
                const isActive = activeGesture === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveGesture(item.id);
                      setGestureConfidence(100);
                      announceSignAndExecute(item.id, {
                        isAuto: false,
                        speakMeaning: voiceSpeakEnabled,
                        runAction: true,
                      });
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-xl shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <span className="font-tech font-bold text-slate-200 block truncate">
                          {language === 'hi' ? item.labelHi : item.labelEn}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {language === 'hi' ? item.meaningHi : item.meaningEn}
                        </span>
                      </div>
                    </div>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400/70 shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trigger History */}
          <div className="space-y-1.5">
            <span className="font-tech font-bold text-slate-300 text-xs tracking-wider">
              GESTURE EVENT TIMELINE
            </span>
            <div className="h-24 rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 overflow-y-auto font-mono-cyber text-[11px] text-slate-300 space-y-1">
              {gestureLogs.length === 0 ? (
                <div className="text-slate-600 italic">
                  Show a hand sign in front of camera or tap a sign card...
                </div>
              ) : (
                gestureLogs.map((log, i) => (
                  <div key={i} className="text-cyan-300">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
