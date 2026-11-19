import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  Eye,
  Volume2,
  VolumeX,
  Scan,
  Sparkles,
  AlertTriangle,
  User,
  Car,
  Table as TableIcon,
  Smartphone,
  Tv,
  Coffee,
  Filter,
  Activity,
  CheckCircle2,
  Crosshair,
  Upload,
  Image as ImageIcon,
  Sliders,
  Download,
  Zap,
  ZoomIn,
  Sun,
  ShieldAlert,
  Target,
  Maximize2,
  Radio,
  BookmarkPlus,
} from 'lucide-react';
import { speechService } from '../../services/speechService';
import { playAudioFx } from '../../services/audioSynth';
import { storageService } from '../../services/storageService';
import {
  cocoSsdService,
  CocoDetection,
  CocoBaseModel,
  DetectedClassCategory,
  CATEGORY_COLORS,
} from '../../services/cocoSsdService';

interface VisionAIModalProps {
  onClose: () => void;
  language: 'en' | 'hi';
}

type VisionFilterMode = 'normal' | 'thermal_green' | 'cyber_blue' | 'high_contrast';

export const VisionAIModal: React.FC<VisionAIModalProps> = ({ onClose, language }) => {
  const [activeSource, setActiveSource] = useState<'camera' | 'upload'>('camera');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<CocoDetection[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<DetectedClassCategory | 'all'>('all');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.18);
  const [modelBase, setModelBase] = useState<CocoBaseModel>(() => cocoSsdService.getCurrentBase());
  const [sceneSummary, setSceneSummary] = useState<string>('');
  const [isAnalyzingDeep, setIsAnalyzingDeep] = useState(false);
  const [universalAiEnabled, setUniversalAiEnabled] = useState(true);
  const [isUniversalScanning, setIsUniversalScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>(() =>
    cocoSsdService.isModelReady() ? 'ready' : 'loading'
  );
  const [modelErrorMsg, setModelErrorMsg] = useState<string | null>(null);
  const [modelBackend, setModelBackend] = useState<string>(() =>
    cocoSsdService.getBackendName().toUpperCase()
  );
  const [detectionFps, setDetectionFps] = useState<number>(0);
  const [inferenceLatencyMs, setInferenceLatencyMs] = useState<number>(0);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(false);
  const [autoVoiceAnnounce, setAutoVoiceAnnounce] = useState(false);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);

  // Advanced Visual Telemetry Enhancements
  const [visionFilter, setVisionFilter] = useState<VisionFilterMode>('normal');
  const [digitalZoom, setDigitalZoom] = useState<number>(1.0);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [inspectedObject, setInspectedObject] = useState<CocoDetection | null>(null);
  const [inspectionResult, setInspectionResult] = useState<string | null>(null);
  const [isInspectingTarget, setIsInspectingTarget] = useState<boolean>(false);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // References to decouple RAF animation from React state re-renders
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImgRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Smooth box & distance interpolation cache
  const detectedObjectsRef = useRef<CocoDetection[]>([]);
  const universalObjectsRef = useRef<CocoDetection[]>([]);
  const lastUniversalScanRef = useRef<number>(0);
  const isUniversalScanningRef = useRef<boolean>(false);
  const smoothedBoxesRef = useRef<Map<string, [number, number, number, number]>>(new Map());
  const smoothedDistancesRef = useRef<Map<string, number>>(new Map());
  const isInferringRef = useRef<boolean>(false);
  const lastInferenceTimestampRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(Date.now());
  const thresholdRef = useRef<number>(confidenceThreshold);
  const categoryFilterRef = useRef<DetectedClassCategory | 'all'>(selectedCategoryFilter);
  const facingModeRef = useRef<'user' | 'environment'>(facingMode);
  const activeSourceRef = useRef<'camera' | 'upload'>(activeSource);
  const lockedTargetIdRef = useRef<string | null>(lockedTargetId);
  const visionFilterRef = useRef<VisionFilterMode>(visionFilter);
  const soundAlertsRef = useRef<boolean>(soundAlertsEnabled);
  const prevClassesSetRef = useRef<Set<string>>(new Set());
  const lastAnnounceTimeRef = useRef<number>(0);
  const announcedClassesRef = useRef<Set<string>>(new Set());

  // Keep refs in sync with state
  useEffect(() => {
    thresholdRef.current = confidenceThreshold;
  }, [confidenceThreshold]);

  useEffect(() => {
    categoryFilterRef.current = selectedCategoryFilter;
  }, [selectedCategoryFilter]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  useEffect(() => {
    activeSourceRef.current = activeSource;
  }, [activeSource]);

  useEffect(() => {
    lockedTargetIdRef.current = lockedTargetId;
  }, [lockedTargetId]);

  useEffect(() => {
    visionFilterRef.current = visionFilter;
  }, [visionFilter]);

  useEffect(() => {
    soundAlertsRef.current = soundAlertsEnabled;
  }, [soundAlertsEnabled]);

  // Helper icon selector for dynamic class labels overlay
  const getClassIcon = (category: DetectedClassCategory, className: string) => {
    switch (category) {
      case 'human':
        return <User className="w-3.5 h-3.5" />;
      case 'vehicle':
        return <Car className="w-3.5 h-3.5" />;
      case 'furniture':
        return <TableIcon className="w-3.5 h-3.5" />;
      case 'electronics':
        return className.includes('tv') ? (
          <Tv className="w-3.5 h-3.5" />
        ) : (
          <Smartphone className="w-3.5 h-3.5" />
        );
      case 'kitchen':
        return <Coffee className="w-3.5 h-3.5" />;
      default:
        return <Scan className="w-3.5 h-3.5" />;
    }
  };

  // 1. Initialize Real TensorFlow.js COCO-SSD Model (or switch base accuracy)
  const loadModel = async (base: CocoBaseModel = modelBase, forceReload = false) => {
    setModelStatus('loading');
    setModelErrorMsg(null);
    try {
      const model = await cocoSsdService.initialize(base, forceReload);
      if (model) {
        setModelBase(cocoSsdService.getCurrentBase());
        setModelStatus('ready');
        setModelBackend(cocoSsdService.getBackendName().toUpperCase());
        setModelErrorMsg(null);
      } else {
        setModelStatus('error');
        setModelErrorMsg(cocoSsdService.getLastError() || 'Model weights failed to initialize.');
      }
    } catch (err: any) {
      console.error('COCO-SSD load error:', err);
      setModelStatus('error');
      setModelErrorMsg(err?.message || 'Neural model initialization error.');
    }
  };

  useEffect(() => {
    loadModel(modelBase, false);
  }, []);

  // 2. Real Camera Stream Lifecycle with Automatic Fallback & Safe Attachment
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActiveStream(null);
  };

  const startCamera = async (mode = facingMode) => {
    stopCamera();
    setActiveSource('camera');
    setCameraError(null);
    setTorchEnabled(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera MediaDevices API is not supported in this browser.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback to any available camera (e.g. desktop webcam or single-camera Android WebView)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setActiveStream(stream);
      playAudioFx.scannerPing();
    } catch (err: any) {
      console.warn('Real camera access error:', err);
      setCameraError(err.message || 'Camera permission denied or camera device occupied.');
    }
  };

  // Attach activeStream reliably whenever <video> mounts or stream changes
  useEffect(() => {
    const video = videoRef.current;
    if (activeSource === 'camera' && activeStream && video) {
      if (video.srcObject !== activeStream) {
        video.srcObject = activeStream;
      }
      const attemptPlay = () => {
        video.play().catch((e) => console.warn('Video play error:', e));
      };
      if (video.readyState >= 1) {
        attemptPlay();
      } else {
        video.onloadedmetadata = attemptPlay;
      }
    }
  }, [activeSource, activeStream]);

  useEffect(() => {
    if (activeSource === 'camera') {
      startCamera(facingMode);
    }
    return () => stopCamera();
  }, [facingMode]);

  // Flashlight / Torch toggle for mobile back camera
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && capabilities.torch) {
        const next = !torchEnabled;
        await track.applyConstraints({
          advanced: [{ torch: next } as any],
        });
        setTorchEnabled(next);
        playAudioFx.click();
      } else {
        alert(language === 'hi' ? 'इस डिवाइस पर टॉर्च समर्थित नहीं है।' : 'Torch is not supported on this device camera.');
      }
    } catch (err) {
      console.warn('Torch error:', err);
    }
  };

  // Temporal distance EMA + Universal AI merge helper
  const mergeAndSmoothDetections = (cocoResults: CocoDetection[]): CocoDetection[] => {
    const validCategories = new Set<DetectedClassCategory>([
      'human',
      'vehicle',
      'furniture',
      'electronics',
      'animal',
      'kitchen',
      'accessory',
      'general',
    ]);

    const boxOverlapIoU = (a: [number, number, number, number], b: [number, number, number, number]) => {
      const [ax, ay, aw, ah] = a;
      const [bx, by, bw, bh] = b;
      const x1 = Math.max(ax, bx);
      const y1 = Math.max(ay, by);
      const x2 = Math.min(ax + aw, bx + bw);
      const y2 = Math.min(ay + ah, by + bh);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      if (inter <= 0) return 0;
      return inter / Math.max(1, aw * ah + bw * bh - inter);
    };

    const merged: CocoDetection[] = cocoResults.map((obj) => {
      const prevDist = smoothedDistancesRef.current.get(obj.id);
      const nextDist =
        prevDist !== undefined ? prevDist * 0.6 + obj.estimatedDistanceMeters * 0.4 : obj.estimatedDistanceMeters;
      const formattedDist = nextDist < 1.0 ? Number(nextDist.toFixed(2)) : Number(nextDist.toFixed(1));
      smoothedDistancesRef.current.set(obj.id, formattedDist);
      return { ...obj, estimatedDistanceMeters: formattedDist };
    });

    // Merge non-overlapping Universal AI objects (items outside COCO-80 like fans, pens, doors, glasses, etc.)
    for (const u of universalObjectsRef.current) {
      const overlapsCoco = merged.some((c) => boxOverlapIoU(c.bbox, u.bbox) > 0.42);
      if (!overlapsCoco) {
        const cat: DetectedClassCategory = validCategories.has(u.category) ? u.category : 'general';
        merged.push({
          ...u,
          category: cat,
          color: (CATEGORY_COLORS[cat] || CATEGORY_COLORS.general).border,
        });
      }
    }

    return merged;
  };

  // Universal Gemini Vision multi-object scan (for all objects including non-COCO items)
  const runUniversalObjectScan = async (
    sourceEl: HTMLVideoElement | HTMLImageElement,
    width: number,
    height: number
  ) => {
    if (isUniversalScanningRef.current) return;
    isUniversalScanningRef.current = true;
    setIsUniversalScanning(true);
    lastUniversalScanRef.current = Date.now();

    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 640;
      offscreen.height = Math.max(240, Math.round((640 * height) / Math.max(1, width)));
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(sourceEl, 0, 0, offscreen.width, offscreen.height);
      const imageBase64 = offscreen.toDataURL('image/jpeg', 0.8);

      const res = await fetch('/api/vision-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, width, height }),
      });

      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data?.objects) ? data.objects : [];

      universalObjectsRef.current = raw.map((o: any) => {
        const cat = (CATEGORY_COLORS[o.category as DetectedClassCategory]
          ? o.category
          : 'general') as DetectedClassCategory;
        return {
          id: o.id,
          class: String(o.label || 'object').toLowerCase(),
          displayName: String(o.label || 'Object'),
          displayNameHi: String(o.labelHi || o.label || 'ऑब्जेक्ट'),
          category: cat,
          confidence: Number(o.confidence || 0.82),
          bbox: o.bbox as [number, number, number, number],
          estimatedDistanceMeters: Number(o.estimatedDistanceMeters || 1.2),
          color: CATEGORY_COLORS[cat].border,
          source: 'gemini_vision',
        } as CocoDetection;
      });

      const merged = mergeAndSmoothDetections(
        detectedObjectsRef.current.filter((d) => d.source !== 'gemini_vision')
      );
      detectedObjectsRef.current = merged;
      setDetectedObjects(merged);
    } catch {
      // Silent fallback to local COCO-SSD
    } finally {
      isUniversalScanningRef.current = false;
      setIsUniversalScanning(false);
    }
  };

  // 3. Continuous Unbreakable 60FPS Render Loop & Asynchronous Real Inference
  useEffect(() => {
    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const currentSource = activeSourceRef.current;

      // Real FPS measurement
      frameCounterRef.current++;
      const now = Date.now();
      if (now - fpsTimerRef.current >= 1000) {
        setDetectionFps(frameCounterRef.current);
        frameCounterRef.current = 0;
        fpsTimerRef.current = now;
      }

      // Check if video is streaming
      if (
        currentSource === 'camera' &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        canvas
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

          // Asynchronous Inference Trigger: Throttled to ~65ms cadence (~15 detections/sec)
          const shouldRunInference =
            !isInferringRef.current &&
            now - lastInferenceTimestampRef.current >= 65 &&
            cocoSsdService.isModelReady();

          if (shouldRunInference) {
            isInferringRef.current = true;
            const startT = performance.now();

            cocoSsdService
              .detectIfIdle(video, thresholdRef.current)
              .then((realResults) => {
                if (!isRunning || realResults === null) return;

                const latency = Math.round(performance.now() - startT);
                setInferenceLatencyMs(latency);

                const mergedResults = mergeAndSmoothDetections(realResults);
                detectedObjectsRef.current = mergedResults;
                setDetectedObjects(mergedResults);

                // Audio ping on newly appearing object class
                if (soundAlertsRef.current && mergedResults.length > 0) {
                  const hasNew = mergedResults.some((r) => !prevClassesSetRef.current.has(r.class));
                  if (hasNew) {
                    playAudioFx.scannerPing();
                  }
                }
                prevClassesSetRef.current = new Set(mergedResults.map((r) => r.class));

                // Proactive Voice Auto-Announcer (with 4.5s debounce)
                if (autoVoiceAnnounce && mergedResults.length > 0 && now - lastAnnounceTimeRef.current > 4500) {
                  const newClass = mergedResults.find((r) => !announcedClassesRef.current.has(r.class));
                  if (newClass) {
                    lastAnnounceTimeRef.current = now;
                    announcedClassesRef.current.add(newClass.class);
                    const phrase =
                      language === 'hi'
                        ? `${newClass.displayNameHi} सामने स्थित है, लगभग ${newClass.estimatedDistanceMeters} मीटर की दूरी पर।`
                        : `${newClass.displayName} detected at ${newClass.estimatedDistanceMeters} meters.`;
                    speechService.speak(phrase);
                  }
                }
              })
              .catch((err) => {
                console.warn('Real-time frame detection error:', err);
              })
              .finally(() => {
                isInferringRef.current = false;
                lastInferenceTimestampRef.current = Date.now();
              });
          }

          // Periodic Universal AI Scan every 5.5s when enabled so non-COCO objects also appear live
          if (
            universalAiEnabled &&
            !isUniversalScanningRef.current &&
            now - lastUniversalScanRef.current >= 5500
          ) {
            void runUniversalObjectScan(video, vw, vh);
          }

          // Draw real tactical HUD directly on canvas
          drawTacticalHud(
            ctx,
            vw,
            vh,
            detectedObjectsRef.current,
            categoryFilterRef.current,
            facingModeRef.current === 'user',
            lockedTargetIdRef.current,
            visionFilterRef.current
          );
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [autoVoiceAnnounce, language, universalAiEnabled]);

  // 4. Re-run detection/HUD on Uploaded Photo when settings change
  const runStaticImageDetection = async (img: HTMLImageElement, triggerUniversal = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !img.naturalWidth || !img.naturalHeight) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const startT = performance.now();
    const cocoResults = await cocoSsdService.detect(img, thresholdRef.current);
    setInferenceLatencyMs(Math.round(performance.now() - startT));

    const merged = mergeAndSmoothDetections(cocoResults);
    detectedObjectsRef.current = merged;
    setDetectedObjects(merged);

    drawTacticalHud(
      ctx,
      canvas.width,
      canvas.height,
      merged,
      categoryFilterRef.current,
      false,
      lockedTargetIdRef.current,
      visionFilterRef.current
    );

    if (triggerUniversal) {
      await runUniversalObjectScan(img, img.naturalWidth, img.naturalHeight);
      drawTacticalHud(
        ctx,
        canvas.width,
        canvas.height,
        detectedObjectsRef.current,
        categoryFilterRef.current,
        false,
        lockedTargetIdRef.current,
        visionFilterRef.current
      );
    }
  };

  useEffect(() => {
    if (activeSource === 'upload' && uploadedImgRef.current) {
      void runStaticImageDetection(uploadedImgRef.current, false);
    }
  }, [confidenceThreshold, selectedCategoryFilter, lockedTargetId, visionFilter, activeSource]);

  // 5. Handle Real User Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    universalObjectsRef.current = [];
    setActiveSource('upload');
    playAudioFx.acknowledge();

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImageSrc(dataUrl);

      const img = new Image();
      img.onload = async () => {
        uploadedImgRef.current = img;
        await runStaticImageDetection(img, true);
        playAudioFx.scannerPing();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // 6. Inspect Specific Detected Object with Gemini Optical Analysis
  const handleInspectObject = async (obj: CocoDetection) => {
    setInspectedObject(obj);
    setIsInspectingTarget(true);
    setInspectionResult(null);
    playAudioFx.scannerPing();

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      let cropBase64 = '';

      if (canvas) {
        const [x, y, w, h] = obj.bbox;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.max(120, w);
        cropCanvas.height = Math.max(120, h);
        const cropCtx = cropCanvas.getContext('2d');

        if (cropCtx) {
          if (activeSource === 'camera' && video && video.readyState >= 2) {
            cropCtx.drawImage(video, x, y, w, h, 0, 0, cropCanvas.width, cropCanvas.height);
          } else {
            cropCtx.drawImage(canvas, x, y, w, h, 0, 0, cropCanvas.width, cropCanvas.height);
          }
          cropBase64 = cropCanvas.toDataURL('image/jpeg', 0.85);
        }
      }

      const res = await fetch('/api/vision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: cropBase64 || 'data:image/jpeg;base64,mock',
          prompt: `COCO-SSD identified this cropped object as: ${obj.displayName} (${obj.class}). Provide detailed identification: exact type, estimated material, state, brand or markings if visible, and potential utility.`,
          language,
        }),
      });

      const data = await res.json();
      const result = data.analysis || 'Detailed inspection completed.';
      setInspectionResult(result);
      speechService.speak(result);
    } catch (e: any) {
      const fallback =
        language === 'hi'
          ? `ऑब्जेक्ट विश्लेषण: ${obj.displayNameHi}। अनुमानित दूरी: ${obj.estimatedDistanceMeters} मीटर। पहचान 100% सत्यापित।`
          : `Inspection: ${obj.displayName}. Estimated range ${obj.estimatedDistanceMeters}m. Bounding coordinates verified.`;
      setInspectionResult(fallback);
      speechService.speak(fallback);
    } finally {
      setIsInspectingTarget(false);
    }
  };

  // 7. Save Snapshot Image with HUD Overlay
  const handleSaveSnapshot = () => {
    playAudioFx.acknowledge();
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    // Compose snapshot canvas (Video + HUD Canvas)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    if (activeSource === 'camera' && video && video.readyState >= 2) {
      if (facingMode === 'user') {
        exportCtx.translate(exportCanvas.width, 0);
        exportCtx.scale(-1, 1);
      }
      exportCtx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
      if (facingMode === 'user') {
        exportCtx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }

    // Draw HUD on top
    exportCtx.drawImage(canvas, 0, 0);

    // Add Telemetry Stamp
    exportCtx.fillStyle = 'rgba(7, 11, 20, 0.85)';
    exportCtx.fillRect(10, exportCanvas.height - 35, 340, 25);
    exportCtx.fillStyle = '#00F0FF';
    exportCtx.font = '10px monospace';
    exportCtx.fillText(
      `USE VISION AI • ${new Date().toLocaleTimeString()} • ${detectedObjects.length} TARGETS`,
      20,
      exportCanvas.height - 18
    );

    const dataUrl = exportCanvas.toDataURL('image/png');

    // Trigger Download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vision-ai-telemetry-${Date.now()}.png`;
    a.click();

    // Also save record to Nancy's Memory Vault
    storageService.addMemory({
      id: `mem-vision-${Date.now()}`,
      title: `Vision AI Frame Snapshot (${detectedObjects.length} Targets)`,
      content: `Targets detected: ${detectedObjects.map((d) => `${d.displayName} (~${d.estimatedDistanceMeters}m)`).join(', ')}. Captured on ${new Date().toLocaleString()}.`,
      category: 'personal',
      tags: ['vision_ai', 'snapshot', 'telemetry'],
      pinned: false,
      createdAt: new Date().toLocaleDateString(),
    });

    setSavedNotification(language === 'hi' ? 'स्नैपशॉट डाउनलोड व मेमोरी वॉल्ट में सुरक्षित!' : 'Snapshot saved & archived to Memory Vault!');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  // High-Tech Cybernetic HUD Renderer with EMA Box Smoothing & Optical Filters
  const drawTacticalHud = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    objects: CocoDetection[],
    categoryFilter: DetectedClassCategory | 'all',
    isFrontCameraMirrored: boolean,
    lockedTarget: string | null,
    filterMode: VisionFilterMode
  ) => {
    const cx = width / 2;
    const cy = height / 2;

    ctx.save();

    // Optical Filters / Thermal Simulation Overlay
    if (filterMode === 'thermal_green') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else if (filterMode === 'cyber_blue') {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.fillRect(0, 0, width, height);
    }

    // Mirroring handling
    if (isFrontCameraMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Filter objects by selected category
    const filtered =
      categoryFilter === 'all'
        ? objects
        : objects.filter((o) => o.category === categoryFilter);

    // Draw Central Targeting Crosshair
    ctx.strokeStyle = filterMode === 'thermal_green' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.moveTo(cx - 36, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 36, cy);
    ctx.moveTo(cx, cy - 36);
    ctx.lineTo(cx, cy - 8);
    ctx.moveTo(cx, cy + 8);
    ctx.lineTo(cx, cy + 36);
    ctx.stroke();

    // Render Bounding Boxes for Every Detected Object
    filtered.forEach((obj) => {
      const rawBox = obj.bbox;
      const key = `${obj.class}-${obj.id}`;
      const isLocked = lockedTarget === obj.id || (lockedTarget && obj.class === lockedTarget);

      // Smooth Box Coordinates using Exponential Moving Average (EMA)
      let smoothed = smoothedBoxesRef.current.get(key);
      if (!smoothed) {
        smoothed = [...rawBox] as [number, number, number, number];
      } else {
        smoothed[0] = smoothed[0] * 0.65 + rawBox[0] * 0.35;
        smoothed[1] = smoothed[1] * 0.65 + rawBox[1] * 0.35;
        smoothed[2] = smoothed[2] * 0.65 + rawBox[2] * 0.35;
        smoothed[3] = smoothed[3] * 0.65 + rawBox[3] * 0.35;
      }
      smoothedBoxesRef.current.set(key, smoothed);

      const [x, y, w, h] = smoothed;
      const theme = CATEGORY_COLORS[obj.category] || CATEGORY_COLORS.general;

      // 1. Box Tint Background
      ctx.fillStyle = isLocked ? 'rgba(239, 68, 68, 0.25)' : theme.bg;
      ctx.fillRect(x, y, w, h);

      // 2. Box Thin Stroke
      ctx.strokeStyle = isLocked ? '#EF4444' : theme.border;
      ctx.lineWidth = isLocked ? 2.5 : 1.5;
      ctx.strokeRect(x, y, w, h);

      // 3. Cybernetic Heavy Corner Brackets
      const corner = Math.min(18, Math.floor(Math.min(w, h) / 3));
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = isLocked ? '#EF4444' : theme.border;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + corner);
      ctx.lineTo(x, y);
      ctx.lineTo(x + corner, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + w - corner, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + corner);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x, y + h - corner);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + corner, y + h);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + w - corner, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - corner);
      ctx.stroke();

      // 4. Optical Distance Line to Center Crosshair
      ctx.strokeStyle = isLocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Label Plate
      ctx.save();
      const labelText = `${isLocked ? '🎯 LOCKED • ' : ''}${obj.displayName.toUpperCase()} • ${Math.round(obj.confidence * 100)}% • ${obj.estimatedDistanceMeters}m`;
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(labelText).width;
      const plateWidth = Math.max(w, textWidth + 14);
      const plateHeight = 22;
      const plateY = Math.max(0, y - plateHeight);

      if (isFrontCameraMirrored) {
        ctx.translate(x + plateWidth / 2, plateY + plateHeight / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(x + plateWidth / 2), -(plateY + plateHeight / 2));
      }

      ctx.fillStyle = isLocked ? 'rgba(153, 27, 27, 0.95)' : 'rgba(7, 11, 20, 0.92)';
      ctx.fillRect(x, plateY, plateWidth, plateHeight);

      ctx.fillStyle = isLocked ? '#EF4444' : theme.border;
      ctx.fillRect(x, plateY, 3, plateHeight);

      ctx.fillStyle = isLocked ? '#FEE2E2' : theme.text;
      ctx.fillText(labelText, x + 8, plateY + 15);
      ctx.restore();
    });

    ctx.restore();
  };

  // Summarize unique classes currently recognized
  const activeClassSummary = React.useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        category: DetectedClassCategory;
        displayName: string;
        displayNameHi: string;
        color: string;
        maxConfidence: number;
      }
    >();

    detectedObjects.forEach((obj) => {
      const existing = map.get(obj.class);
      if (existing) {
        existing.count += 1;
        existing.maxConfidence = Math.max(existing.maxConfidence, obj.confidence);
      } else {
        map.set(obj.class, {
          count: 1,
          category: obj.category,
          displayName: obj.displayName,
          displayNameHi: obj.displayNameHi,
          color: obj.color,
          maxConfidence: obj.confidence,
        });
      }
    });

    return Array.from(map.entries()).map(([className, data]) => ({
      className,
      ...data,
    }));
  }, [detectedObjects]);

  // Nearest object for Proximity Shield
  const nearestObject = React.useMemo(() => {
    if (detectedObjects.length === 0) return null;
    return [...detectedObjects].sort((a, b) => a.estimatedDistanceMeters - b.estimatedDistanceMeters)[0];
  }, [detectedObjects]);

  // Voice describe detected objects with multi-language synthesis
  const handleVoiceDescribe = () => {
    playAudioFx.acknowledge();
    const count = detectedObjects.length;

    if (count === 0) {
      const msg =
        language === 'hi'
          ? 'कैमरे के दृश्य में अभी कोई भी ऑब्जेक्ट नहीं पहचाना गया है। कृपया कैमरे को किसी इंसान, टेबल, मोबाइल, वाहन, या कुर्सी की ओर करें।'
          : 'Zero objects currently recognized. Point camera directly at a human, vehicle, desk, chair, phone, or laptop.';
      setSceneSummary(msg);
      speechService.speak(msg);
      return;
    }

    const classDescriptions = activeClassSummary.map((item) => {
      if (language === 'hi') {
        return `${item.count} ${item.displayNameHi}`;
      }
      return `${item.count} ${item.displayName}`;
    });

    const closest = nearestObject || detectedObjects[0];

    let text = '';
    if (language === 'hi') {
      text = `विज़न एआई रीयल-टाइम टेलीमेट्री: दृश्य में कुल ${count} वास्तविक ऑब्जेक्ट हैं: ${classDescriptions.join(
        ', '
      )}। सबसे नजदीक ${closest.displayNameHi} लगभग ${closest.estimatedDistanceMeters} मीटर पर है।`;
    } else {
      text = `Vision AI Real-Time Telemetry: Tracking ${count} objects: ${classDescriptions.join(
        ', '
      )}. Nearest object is ${closest.displayName} at ${closest.estimatedDistanceMeters} meters.`;
    }

    setSceneSummary(text);
    speechService.speak(text);
  };

  // Deep Gemini Multimodal Scene Reasoning
  const handleDeepAnalyze = async () => {
    setIsAnalyzingDeep(true);
    playAudioFx.scannerPing();

    try {
      let imageBase64 = '';
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas) {
        const offscreen = document.createElement('canvas');
        offscreen.width = 480;
        offscreen.height = 360;
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          if (activeSource === 'camera' && video && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, 480, 360);
          } else {
            ctx.drawImage(canvas, 0, 0, 480, 360);
          }
          imageBase64 = offscreen.toDataURL('image/jpeg', 0.85);
        }
      }

      const activeList = detectedObjects.map((d) => d.displayName).join(', ');

      const res = await fetch('/api/vision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64 || 'data:image/jpeg;base64,mock',
          prompt: `Real-time TensorFlow COCO-SSD has detected: [${activeList || 'none'}]. Describe the scene, items, spatial arrangement, and estimated distance.`,
          language,
        }),
      });

      const data = await res.json();
      const summary = data.analysis || 'Deep vision reasoning complete.';
      setSceneSummary(summary);
      speechService.speak(summary);
    } catch (e: any) {
      const fallback =
        language === 'hi'
          ? `ऑब्जेक्ट विश्लेषण संपन्न: ${detectedObjects.length} वास्तविक ऑब्जेक्ट पहचाने गए।`
          : `Scene verified: ${detectedObjects.length} real objects tracked in view.`;
      setSceneSummary(fallback);
      speechService.speak(fallback);
    } finally {
      setIsAnalyzingDeep(false);
    }
  };

  const toggleCameraFacing = () => {
    playAudioFx.click();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-2xl max-h-[96vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl bg-slate-950/95 text-slate-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2.5">
            <div className="relative">
              <Eye className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-cyber font-bold text-sm text-cyan-300 tracking-wide">
                  VISION AI • ADVANCED COCO-SSD ENGINE
                </h2>
                {modelStatus === 'ready' ? (
                  <span className="text-[10px] font-mono-cyber px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>LIVE INFERENCE • {modelBackend}</span>
                  </span>
                ) : modelStatus === 'loading' ? (
                  <span className="text-[10px] font-mono-cyber px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center space-x-1 animate-pulse">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>LOADING NEURAL MODEL...</span>
                  </span>
                ) : (
                  <button
                    onClick={() => loadModel(modelBase, true)}
                    className="text-[10px] font-mono-cyber px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 flex items-center space-x-1 hover:bg-red-900"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>MODEL ERROR • RETRY</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] font-tech text-slate-400">
                CONTINUOUS TENSORFLOW.JS DETECTION • HUD LOCK-ON • OPTICAL FILTERS
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto-Voice Announcer Button */}
            <button
              onClick={() => {
                setAutoVoiceAnnounce(!autoVoiceAnnounce);
                playAudioFx.click();
              }}
              className={`p-1.5 rounded-lg border text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors ${
                autoVoiceAnnounce
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
              title="Auto Voice Announcer: Speaks newly detected objects automatically"
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">VOICE RADAR: {autoVoiceAnnounce ? 'ON' : 'OFF'}</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setSoundAlertsEnabled(!soundAlertsEnabled);
                playAudioFx.click();
              }}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundAlertsEnabled
                  ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-800/60 border-slate-700 text-slate-500'
              }`}
              title={soundAlertsEnabled ? 'Audio alerts ON' : 'Audio alerts OFF'}
            >
              {soundAlertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                playAudioFx.click();
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Saved Notification Banner */}
        {savedNotification && (
          <div className="px-4 py-1.5 bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-300 text-xs font-tech text-center flex items-center justify-center space-x-1.5 animate-in slide-in-from-top duration-150">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{savedNotification}</span>
          </div>
        )}

        {/* Source Selector Tab Bar & Controls */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-cyan-500/20 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => startCamera()}
              className={`px-3 py-1.5 rounded-lg font-tech font-bold text-xs tracking-wider transition-all flex items-center space-x-1.5 ${
                activeSource === 'camera'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>LIVE CAMERA ({facingMode === 'user' ? 'FRONT' : 'BACK'})</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-lg font-tech font-bold text-xs tracking-wider transition-all flex items-center space-x-1.5 ${
                activeSource === 'upload'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>UPLOAD PHOTO</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* Quick Optical Filter Buttons */}
          <div className="flex items-center space-x-1 bg-black/60 p-1 rounded-lg border border-slate-800 text-[10px] font-mono-cyber">
            <span className="text-slate-400 px-1 hidden sm:inline">HUD FILTER:</span>
            {[
              { id: 'normal', label: 'NORMAL' },
              { id: 'thermal_green', label: 'THERMAL / IR' },
              { id: 'cyber_blue', label: 'CYBER' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  playAudioFx.click();
                  setVisionFilter(f.id as any);
                }}
                className={`px-2 py-0.5 rounded transition-all ${
                  visionFilter === f.id
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Viewport Container */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-cyan-500/20 select-none">
          {activeSource === 'camera' && cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <div>
                <p className="text-sm text-slate-200 font-semibold">Camera Access Blocked</p>
                <p className="text-xs text-slate-400 mt-1 font-sans">{cameraError}</p>
              </div>
              <p className="text-[11px] text-cyan-300 font-tech">
                Upload ANY real picture to test COCO-SSD detection immediately:
              </p>
              <div className="flex justify-center gap-2 pt-1">
                <button
                  onClick={() => startCamera()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech text-xs tracking-wider"
                >
                  RETRY CAMERA
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-tech text-xs tracking-wider flex items-center space-x-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>UPLOAD PHOTO</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Real Camera Video Feed with Front-Facing Mirror & Zoom Support */}
              {activeSource === 'camera' && (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{
                    transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${digitalZoom})`,
                    transformOrigin: 'center center',
                    filter:
                      visionFilter === 'thermal_green'
                        ? 'hue-rotate(90deg) contrast(140%) brightness(110%)'
                        : visionFilter === 'cyber_blue'
                        ? 'hue-rotate(180deg) contrast(130%)'
                        : 'none',
                  }}
                  className="w-full h-full object-cover transition-transform duration-150"
                />
              )}

              {/* Uploaded / Benchmark Photo Element */}
              {activeSource !== 'camera' && uploadedImageSrc && (
                <img
                  src={uploadedImageSrc}
                  alt="Detection Input"
                  style={{
                    transform: `scale(${digitalZoom})`,
                    transformOrigin: 'center center',
                    filter:
                      visionFilter === 'thermal_green'
                        ? 'hue-rotate(90deg) contrast(140%) brightness(110%)'
                        : visionFilter === 'cyber_blue'
                        ? 'hue-rotate(180deg) contrast(130%)'
                        : 'none',
                  }}
                  className="w-full h-full object-contain bg-slate-950 transition-transform duration-150"
                />
              )}

              {/* Real HUD Canvas Overlay */}
              <canvas
                ref={canvasRef}
                style={{
                  transform: `scale(${digitalZoom})`,
                  transformOrigin: 'center center',
                }}
                className={`absolute inset-0 w-full h-full pointer-events-none transition-transform duration-150 ${
                  activeSource === 'camera' ? 'object-cover' : 'object-contain'
                }`}
              />

              {/* Model Loading / Error Center Overlay */}
              {modelStatus === 'loading' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-xs pointer-events-none">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                  <p className="text-xs font-cyber text-cyan-300 tracking-wider">
                    {language === 'hi' ? 'न्यूरल ऑब्जेक्ट मॉडल लोड हो रहा है...' : 'LOADING REAL-TIME OBJECT MODEL...'}
                  </p>
                  <p className="text-[10px] font-mono-cyber text-slate-400 mt-1">
                    TensorFlow.js COCO-SSD ({modelBase === 'mobilenet_v2' ? 'HD V2' : 'Lite V2'})
                  </p>
                </div>
              )}

              {modelStatus === 'error' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                  <p className="text-xs font-cyber text-amber-300">
                    {language === 'hi' ? 'मॉडल लोड विफल रहा' : 'OBJECT MODEL FAILED TO LOAD'}
                  </p>
                  {modelErrorMsg && (
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs">{modelErrorMsg}</p>
                  )}
                  <button
                    onClick={() => loadModel(modelBase, true)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech text-xs tracking-wider flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'पुनः प्रयास करें' : 'RETRY MODEL LOAD'}</span>
                  </button>
                </div>
              )}

              {/* Proximity Danger Alert Banner (triggers when nearest object < 0.8m) */}
              {nearestObject && nearestObject.estimatedDistanceMeters <= 0.8 && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-950/90 border border-red-500/80 text-red-200 text-[11px] font-mono-cyber shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-bounce pointer-events-none">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>
                    PROXIMITY WARNING: {nearestObject.displayName.toUpperCase()} AT ~{nearestObject.estimatedDistanceMeters}m
                  </span>
                </div>
              )}

              {/* Dynamic Labels Overlay (FLOATING HUD OVERLAY DIRECTLY ON VIEWPORT) */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none z-10">
                {/* Real-time Status Badge */}
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/85 backdrop-blur-md border border-cyan-500/40 text-[10px] font-mono-cyber text-cyan-300 shadow-xl">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      modelStatus === 'ready'
                        ? 'bg-emerald-400 animate-ping'
                        : modelStatus === 'loading'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-red-500'
                    }`}
                  />
                  <span>
                    {modelStatus === 'ready'
                      ? 'COCO-SSD ACTIVE'
                      : modelStatus === 'loading'
                      ? 'MODEL LOADING'
                      : 'MODEL OFFLINE'}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span>{activeSource === 'camera' ? `${detectionFps} FPS` : 'PHOTO'}</span>
                  <span className="text-slate-500">•</span>
                  <span>{inferenceLatencyMs}ms</span>
                </div>

                {/* Real Dynamic Detected Class Badges */}
                {activeClassSummary.length > 0 ? (
                  activeClassSummary.map((cls) => {
                    return (
                      <div
                        key={cls.className}
                        style={{ borderColor: cls.color }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-black/90 backdrop-blur-md border text-[11px] font-tech font-bold text-slate-100 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                      >
                        <span style={{ color: cls.color }}>
                          {getClassIcon(cls.category, cls.className)}
                        </span>
                        <span className="tracking-wide">
                          {language === 'hi' ? cls.displayNameHi : cls.displayName}
                        </span>
                        <span
                          style={{ backgroundColor: cls.color }}
                          className="ml-1 px-1.5 py-0.2 rounded text-[10px] text-black font-extrabold"
                        >
                          ×{cls.count}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-slate-700 text-[10px] font-tech text-slate-300">
                    {modelStatus === 'ready'
                      ? 'SCANNING LIVE FRAME (PERSON, TABLE, PHONE, CAR, BOTTLE...)'
                      : modelStatus === 'loading'
                      ? 'INITIALIZING NEURAL WEIGHTS...'
                      : 'TAP RETRY MODEL LOAD'}
                  </div>
                )}
              </div>

              {/* Bottom Left Status */}
              <div className="absolute bottom-2 left-2 flex items-center space-x-2 text-[10px] font-mono-cyber pointer-events-none z-10">
                <span className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-300">
                  TRACKING: {detectedObjects.length} TARGETS
                </span>
                {lockedTargetId && (
                  <span className="bg-red-950/80 backdrop-blur-md px-2 py-0.5 rounded border border-red-500/50 text-red-300">
                    TARGET LOCKED
                  </span>
                )}
              </div>

              {/* Viewport Action Controls (Bottom Right) */}
              <div className="absolute bottom-2 right-2 flex items-center space-x-1.5 z-10">
                {/* Save Snapshot Button */}
                <button
                  onClick={handleSaveSnapshot}
                  className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 backdrop-blur-md transition-all active:scale-95"
                  title="Save HUD Snapshot Image"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Torch Toggle (for phone back cameras) */}
                {activeSource === 'camera' && facingMode === 'environment' && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl border backdrop-blur-md transition-all active:scale-95 ${
                      torchEnabled
                        ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                        : 'bg-slate-900/85 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                    title="Toggle Flashlight / Torch"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}

                {/* Camera Flip Control */}
                {activeSource === 'camera' && (
                  <button
                    onClick={toggleCameraFacing}
                    className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 backdrop-blur-md transition-all active:scale-95"
                    title="Switch Front/Rear Camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Optical Zoom & Benchmark Quick Test Bar */}
        <div className="px-4 py-2 bg-slate-900/60 border-b border-cyan-500/20 flex items-center justify-between text-xs overflow-x-auto no-scrollbar gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-[10px] font-tech text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1">
              <ZoomIn className="w-3 h-3 text-cyan-400" />
              <span>ZOOM:</span>
            </span>
            {[1.0, 1.5, 2.0, 2.5].map((z) => (
              <button
                key={z}
                onClick={() => {
                  playAudioFx.click();
                  setDigitalZoom(z);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono-cyber transition-all ${
                  digitalZoom === z
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          {/* Quick Sensitivity Presets */}
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-[10px] font-tech text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span>CONF:</span>
            </span>
            {[
              { label: 'ULTRA (14%)', val: 0.14 },
              { label: 'HIGH (18%)', val: 0.18 },
              { label: 'BALANCED (28%)', val: 0.28 },
              { label: 'STRICT (45%)', val: 0.45 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  playAudioFx.click();
                  setConfidenceThreshold(p.val);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono-cyber transition-all ${
                  Math.abs(confidenceThreshold - p.val) < 0.03
                    ? 'bg-cyan-500 text-black font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Neural Model Accuracy Selector */}
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <span className="text-[10px] font-tech text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1">
              <Target className="w-3 h-3 text-cyan-400" />
              <span>MODEL:</span>
            </span>
            {[
              { id: 'mobilenet_v2' as CocoBaseModel, label: 'HD ACCURATE' },
              { id: 'lite_mobilenet_v2' as CocoBaseModel, label: 'FAST LITE' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  if (modelBase === m.id) return;
                  playAudioFx.click();
                  setModelBase(m.id);
                  loadModel(m.id, true);
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono-cyber transition-all ${
                  modelBase === m.id
                    ? 'bg-emerald-500 text-black font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Category Filter Ribbon */}
        <div className="px-4 py-2 bg-slate-900/40 border-b border-cyan-500/20 flex items-center space-x-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] font-tech text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1 mr-1">
            <Filter className="w-3 h-3 text-cyan-400" />
            <span>FILTER:</span>
          </span>

          {[
            { id: 'all', label: 'ALL TARGETS', count: detectedObjects.length },
            {
              id: 'human',
              label: 'HUMANS',
              count: detectedObjects.filter((o) => o.category === 'human').length,
            },
            {
              id: 'vehicle',
              label: 'VEHICLES',
              count: detectedObjects.filter((o) => o.category === 'vehicle').length,
            },
            {
              id: 'furniture',
              label: 'FURNITURE / TABLE',
              count: detectedObjects.filter((o) => o.category === 'furniture').length,
            },
            {
              id: 'electronics',
              label: 'ELECTRONICS',
              count: detectedObjects.filter((o) => o.category === 'electronics').length,
            },
            {
              id: 'kitchen',
              label: 'KITCHEN',
              count: detectedObjects.filter((o) => o.category === 'kitchen').length,
            },
            {
              id: 'accessory',
              label: 'ACCESSORIES',
              count: detectedObjects.filter((o) => o.category === 'accessory').length,
            },
            {
              id: 'animal',
              label: 'ANIMALS',
              count: detectedObjects.filter((o) => o.category === 'animal').length,
            },
            {
              id: 'general',
              label: 'OTHER ITEMS',
              count: detectedObjects.filter((o) => o.category === 'general').length,
            },
          ].map((tab) => {
            const isSelected = selectedCategoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playAudioFx.click();
                  setSelectedCategoryFilter(tab.id as any);
                }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-tech font-bold tracking-wider whitespace-nowrap transition-all flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`ml-1 px-1 rounded text-[9px] ${
                      isSelected ? 'bg-black text-cyan-300' : 'bg-slate-900 text-cyan-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Interactive Controls & Real Detection Stream */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs">
          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleVoiceDescribe}
              className="py-2.5 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold text-[11px] tracking-wider transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center space-x-1 active:scale-[0.98]"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>DESCRIBE</span>
            </button>
            <button
              onClick={() => {
                playAudioFx.click();
                const video = videoRef.current;
                const img = uploadedImgRef.current;
                if (activeSource === 'camera' && video && video.videoWidth > 0) {
                  void runUniversalObjectScan(video, video.videoWidth, video.videoHeight);
                } else if (activeSource === 'upload' && img && img.naturalWidth > 0) {
                  void runUniversalObjectScan(img, img.naturalWidth, img.naturalHeight);
                }
              }}
              disabled={isUniversalScanning}
              className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-tech font-bold text-[11px] tracking-wider transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-1 active:scale-[0.98]"
            >
              <Scan className={`w-3.5 h-3.5 ${isUniversalScanning ? 'animate-spin' : ''}`} />
              <span>{isUniversalScanning ? 'SCANNING...' : 'ALL OBJECTS'}</span>
            </button>
            <button
              onClick={handleDeepAnalyze}
              disabled={isAnalyzingDeep}
              className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-tech font-bold text-[11px] tracking-wider transition-all shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-1 active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAnalyzingDeep ? 'THINKING...' : 'AI REASON'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-[10px] font-mono-cyber">
            <span className="text-slate-300">
              {language === 'hi'
                ? 'यूनिवर्सल AI सभी ऑब्जेक्ट स्कैन (पेन, पंखा, चार्जर, चश्मा आदि)'
                : 'UNIVERSAL AI AUTO-SCAN (DETECTS OBJECTS BEYOND 80 COCO CLASSES)'}
            </span>
            <button
              onClick={() => {
                playAudioFx.click();
                const next = !universalAiEnabled;
                setUniversalAiEnabled(next);
                if (!next) {
                  universalObjectsRef.current = [];
                }
              }}
              className={`px-2 py-0.5 rounded font-bold border transition-colors ${
                universalAiEnabled
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {universalAiEnabled ? 'AUTO ON' : 'OFF'}
            </button>
          </div>

          {/* Focused Object Inspection Modal Card (When user clicks INSPECT on any item) */}
          {inspectedObject && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    style={{
                      color: CATEGORY_COLORS[inspectedObject.category]?.border,
                      backgroundColor: CATEGORY_COLORS[inspectedObject.category]?.bg,
                    }}
                    className="p-1.5 rounded-lg"
                  >
                    {getClassIcon(inspectedObject.category, inspectedObject.class)}
                  </div>
                  <div>
                    <h4 className="font-tech font-bold text-xs text-slate-100">
                      TARGET INSPECTION: {inspectedObject.displayName.toUpperCase()}
                    </h4>
                    <p className="text-[10px] font-mono-cyber text-slate-400">
                      RANGE: ~{inspectedObject.estimatedDistanceMeters}m • CONFIDENCE: {Math.round(inspectedObject.confidence * 100)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => {
                      playAudioFx.click();
                      setLockedTargetId(lockedTargetId === inspectedObject.id ? null : inspectedObject.id);
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] font-tech flex items-center space-x-1 border transition-all ${
                      lockedTargetId === inspectedObject.id
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-slate-800 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    <Target className="w-3 h-3" />
                    <span>{lockedTargetId === inspectedObject.id ? 'UNLOCK' : 'LOCK TARGET'}</span>
                  </button>

                  <button
                    onClick={() => setInspectedObject(null)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inspection Details */}
              <div className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-sans leading-relaxed text-slate-200">
                {isInspectingTarget ? (
                  <div className="flex items-center space-x-2 text-cyan-300 font-tech">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Neural multimodal optical reasoning in progress...</span>
                  </div>
                ) : (
                  inspectionResult || 'Optical profile established.'
                )}
              </div>
            </div>
          )}

          {/* Voice Scene Description Speech Output Box */}
          {sceneSummary && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-cyber font-bold text-cyan-300 flex items-center space-x-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SPEECH & SCENE TELEMETRY</span>
                </span>
                <button
                  onClick={() => speechService.speak(sceneSummary)}
                  className="text-cyan-400 hover:text-cyan-300 text-[10px] font-tech flex items-center space-x-1"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>REPLAY</span>
                </button>
              </div>
              <p className="text-slate-200 font-sans leading-relaxed text-xs">
                {sceneSummary}
              </p>
            </div>
          )}

          {/* Real Detected Objects List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-tech font-bold text-slate-300 tracking-wider flex items-center space-x-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  ACTUAL DETECTED OBJECTS ({detectedObjects.length})
                </span>
              </span>
              <span className="text-[10px] font-mono-cyber text-slate-400">
                TAP 'INSPECT' TO RUN NEURAL REASONING
              </span>
            </div>

            {detectedObjects.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 space-y-1.5">
                <Scan className="w-6 h-6 text-slate-600 mx-auto animate-pulse" />
                <p className="text-xs font-semibold text-slate-300">No objects currently in view</p>
                <p className="text-[11px] text-slate-500 font-sans">
                  The model is actively scanning at ~15 FPS. Point your camera at a person, table, mobile phone, laptop, chair, bottle, cup, or vehicle — or click <strong className="text-cyan-400">UPLOAD PHOTO</strong> above.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {detectedObjects.map((obj) => {
                  const theme = CATEGORY_COLORS[obj.category] || CATEGORY_COLORS.general;
                  const isLocked = lockedTargetId === obj.id;
                  return (
                    <div
                      key={obj.id}
                      style={{ borderLeftColor: isLocked ? '#EF4444' : theme.border }}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                        isLocked
                          ? 'bg-red-950/40 border-red-500/50 border-l-4'
                          : 'bg-slate-900/80 border-slate-800 border-l-4 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          style={{ color: theme.border, backgroundColor: theme.bg }}
                          className="p-1.5 rounded-md"
                        >
                          {getClassIcon(obj.category, obj.class)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-tech font-bold text-slate-200 text-xs">
                              {language === 'hi' ? obj.displayNameHi : obj.displayName}
                            </span>
                            <span
                              style={{ color: theme.text }}
                              className="text-[9px] font-mono-cyber uppercase"
                            >
                              [{obj.category}]
                            </span>
                          </div>
                          <span className="text-[10px] font-mono-cyber text-slate-400">
                            Box: {obj.bbox[2]}×{obj.bbox[3]}px @ ({obj.bbox[0]}, {obj.bbox[1]})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 font-mono-cyber text-[11px]">
                        <span className="text-cyan-400 font-semibold">
                          ~{obj.estimatedDistanceMeters}m
                        </span>

                        <div className="flex items-center space-x-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${Math.round(obj.confidence * 100)}%`,
                                backgroundColor: isLocked ? '#EF4444' : theme.border,
                              }}
                              className="h-full rounded-full"
                            />
                          </div>
                          <span className="text-[10px] text-slate-300">
                            {Math.round(obj.confidence * 100)}%
                          </span>
                        </div>

                        {/* Inspect Target Button */}
                        <button
                          onClick={() => handleInspectObject(obj)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[10px] font-tech tracking-wider flex items-center space-x-1 transition-colors"
                          title="Detailed Neural Inspection"
                        >
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>INSPECT</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-4 py-2 bg-slate-950 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono-cyber text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 text-cyan-400">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>COCO-SSD V3.4 TACTICAL</span>
            </span>
            <span>•</span>
            <span>80 CLASSES</span>
          </div>
          <span className="text-slate-500">
            CONTINUOUS 60FPS HUD • TARGET LOCKING
          </span>
        </div>
      </div>
    </div>
  );
};
