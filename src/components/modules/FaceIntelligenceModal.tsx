import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserCheck,
  UserPlus,
  Trash2,
  ShieldCheck,
  Camera,
  RefreshCw,
  AlertTriangle,
  ScanFace,
  Volume2,
  VolumeX,
  Upload,
  Plus,
} from 'lucide-react';
import { FaceEnrollment } from '../../types/nancy';
import { storageService } from '../../services/storageService';
import { playAudioFx } from '../../services/audioSynth';
import { speechService } from '../../services/speechService';
import {
  faceService,
  DetectedFaceResult,
  ExtractedPhotoFace,
  FACE_CONNECTIONS,
} from '../../services/faceService';

interface FaceIntelligenceModalProps {
  onClose: () => void;
  language: 'en' | 'hi';
}

interface LiveFaceSummary {
  index: number;
  isRecognized: boolean;
  name: string | null;
  confidence: number;
  distanceMeters: number;
}

const formatDistanceCompact = (meters: number): string => {
  if (!Number.isFinite(meters) || meters <= 0) return '—';
  if (meters < 1.0) return `${Math.round(meters * 100)} cm`;
  return `${meters.toFixed(2).replace(/\.?0+$/, '')} m`;
};

const formatDistanceSpoken = (meters: number, lang: 'en' | 'hi'): string => {
  if (!Number.isFinite(meters) || meters <= 0) return '';
  if (meters < 1.0) {
    const cm = Math.round(meters * 100);
    return lang === 'hi' ? `${cm} सेंटीमीटर` : `${cm} centimeters`;
  }
  const mStr = meters.toFixed(1).replace(/\.0$/, '');
  return lang === 'hi' ? `${mStr} मीटर` : `${mStr} meters`;
};

export const FaceIntelligenceModal: React.FC<FaceIntelligenceModalProps> = ({ onClose, language }) => {
  const [faces, setFaces] = useState<FaceEnrollment[]>(() => storageService.getFaceEnrollments());
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollSource, setEnrollSource] = useState<'camera' | 'photo'>('camera');
  const [selectedLiveFaceIndex, setSelectedLiveFaceIndex] = useState<number>(0);
  const [uploadedPhotoFaces, setUploadedPhotoFaces] = useState<ExtractedPhotoFace[]>([]);
  const [selectedPhotoFaceIndex, setSelectedPhotoFaceIndex] = useState<number>(0);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);

  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState('Authorized User');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>(() =>
    faceService.isReady() ? 'ready' : 'loading'
  );
  const [modelErrorMsg, setModelErrorMsg] = useState<string | null>(null);
  const [delegateName, setDelegateName] = useState<string>(() => faceService.getDelegate());

  const [recognizedMatches, setRecognizedMatches] = useState<
    Array<{ id: string; name: string; role: string; confidence: number; distanceMeters: number }>
  >([]);
  const [liveFaceSummaries, setLiveFaceSummaries] = useState<LiveFaceSummary[]>([]);
  const [primaryDistanceMeters, setPrimaryDistanceMeters] = useState<number>(0);
  const [topUnrecognizedConfidence, setTopUnrecognizedConfidence] = useState<number>(0);
  const [facesCount, setFacesCount] = useState<number>(0);
  const [headPoseInfo, setHeadPoseInfo] = useState<string>('CENTER • 0°');
  const [fps, setFps] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [showWireframeMesh, setShowWireframeMesh] = useState<boolean>(true);
  const [voiceAnnounceEnabled, setVoiceAnnounceEnabled] = useState<boolean>(true);
  const [lastSpokenLabel, setLastSpokenLabel] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);

  const facesRef = useRef<FaceEnrollment[]>(faces);
  const facingModeRef = useRef<'user' | 'environment'>(facingMode);
  const showMeshRef = useRef<boolean>(showWireframeMesh);
  const voiceAnnounceRef = useRef<boolean>(voiceAnnounceEnabled);
  const languageRef = useRef<'en' | 'hi'>(language);
  const isEnrollingRef = useRef<boolean>(isEnrolling);
  const selectedLiveIdxRef = useRef<number>(selectedLiveFaceIndex);

  const allDetectedFacesRef = useRef<DetectedFaceResult[]>([]);
  const lastFrameDetectRef = useRef<number>(0);
  const lastUiSyncRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(Date.now());

  const consecutiveMatchFramesRef = useRef<Map<string, number>>(new Map());
  const lastSpokenByFaceIdRef = useRef<Map<string, number>>(new Map());
  const smoothedDistancesRef = useRef<Map<string, number>>(new Map());
  const lastGlobalSpeakTimeRef = useRef<number>(0);

  useEffect(() => {
    facesRef.current = faces;
  }, [faces]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  useEffect(() => {
    showMeshRef.current = showWireframeMesh;
  }, [showWireframeMesh]);

  useEffect(() => {
    voiceAnnounceRef.current = voiceAnnounceEnabled;
  }, [voiceAnnounceEnabled]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    isEnrollingRef.current = isEnrolling;
  }, [isEnrolling]);

  useEffect(() => {
    selectedLiveIdxRef.current = selectedLiveFaceIndex;
  }, [selectedLiveFaceIndex]);

  // 1. Initialize real MediaPipe FaceLandmarker and backfill descriptors for any legacy enrolled photos
  const initFaceModel = async (forceReload = false) => {
    setModelStatus('loading');
    setModelErrorMsg(null);
    const model = await faceService.initialize(forceReload);
    if (model) {
      setModelStatus('ready');
      setDelegateName(faceService.getDelegate());
      setModelErrorMsg(null);

      // Backfill descriptors for older enrolled profiles that only have photoUrl
      const stored = storageService.getFaceEnrollments();
      let changed = false;
      const upgraded = await Promise.all(
        stored.map(async (f) => {
          const hasDescriptors =
            (Array.isArray(f.descriptors) && f.descriptors.length > 0) ||
            (Array.isArray(f.descriptor) && f.descriptor.length > 0);
          if (!hasDescriptors && f.photoUrl) {
            const desc = await faceService.extractDescriptorFromImageUrl(f.photoUrl);
            if (desc && desc.length > 0) {
              changed = true;
              return { ...f, descriptor: desc, descriptors: [desc] };
            }
          }
          return f;
        })
      );
      if (changed) {
        setFaces(upgraded);
        storageService.saveFaceEnrollments(upgraded);
      }
    } else {
      setModelStatus('error');
      setModelErrorMsg(faceService.getLastError() || 'Failed to initialize MediaPipe Face Landmarker.');
    }
  };

  useEffect(() => {
    initFaceModel(false);
  }, []);

  // 2. Real Camera Lifecycle with mobile/desktop fallback
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
        video.play().catch((e) => console.warn('Face video play error:', e));
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

  // 3. Real-Time Multi-Face 468-Landmark Mesh, Recognition & Spoken Name Announcement Loop
  useEffect(() => {
    let isRunning = true;

    const drawConnections = (
      ctx: CanvasRenderingContext2D,
      lms: DetectedFaceResult['landmarks'],
      connections: Array<{ start: number; end: number }>,
      w: number,
      h: number,
      strokeStyle: string,
      lineWidth: number
    ) => {
      if (!connections || connections.length === 0) return;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        const p1 = lms[c.start];
        const p2 = lms[c.end];
        if (p1 && p2) {
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
        }
      }
      ctx.stroke();
    };

    const drawFacesOverlay = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      detectedFaces: DetectedFaceResult[],
      isMirrored: boolean
    ) => {
      ctx.save();
      if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      const activeTargetIdx = Math.min(
        selectedLiveIdxRef.current,
        Math.max(0, detectedFaces.length - 1)
      );

      detectedFaces.forEach((face, idx) => {
        const lms = face.landmarks;
        const bx = face.box.x * width;
        const by = face.box.y * height;
        const bw = face.box.width * width;
        const bh = face.box.height * height;

        const hasEnrolled = facesRef.current.length > 0;
        const isEnrollTarget = isEnrollingRef.current && idx === activeTargetIdx;
        const primaryColor = face.isRecognized
          ? '#10B981'
          : isEnrollTarget
          ? '#22D3EE'
          : hasEnrolled
          ? '#F59E0B'
          : '#00F0FF';

        if (showMeshRef.current) {
          drawConnections(
            ctx,
            lms,
            FACE_CONNECTIONS.TESSELATION,
            width,
            height,
            face.isRecognized ? 'rgba(16, 185, 129, 0.16)' : 'rgba(34, 211, 238, 0.16)',
            0.7
          );
        }

        drawConnections(ctx, lms, FACE_CONNECTIONS.FACE_OVAL, width, height, primaryColor, 1.8);
        drawConnections(ctx, lms, FACE_CONNECTIONS.LEFT_EYE, width, height, '#38BDF8', 1.4);
        drawConnections(ctx, lms, FACE_CONNECTIONS.RIGHT_EYE, width, height, '#38BDF8', 1.4);
        drawConnections(ctx, lms, FACE_CONNECTIONS.LEFT_IRIS, width, height, '#FACC15', 1.4);
        drawConnections(ctx, lms, FACE_CONNECTIONS.RIGHT_IRIS, width, height, '#FACC15', 1.4);
        drawConnections(ctx, lms, FACE_CONNECTIONS.LEFT_EYEBROW, width, height, '#A5F3FC', 1.3);
        drawConnections(ctx, lms, FACE_CONNECTIONS.RIGHT_EYEBROW, width, height, '#A5F3FC', 1.3);
        drawConnections(ctx, lms, FACE_CONNECTIONS.LIPS, width, height, '#34D399', 1.4);

        const corner = Math.max(12, Math.min(24, bw * 0.18));
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = isEnrollTarget ? 3 : 2.4;
        ctx.beginPath();
        ctx.moveTo(bx, by + corner);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + corner, by);
        ctx.moveTo(bx + bw - corner, by);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(bx + bw, by + corner);
        ctx.moveTo(bx, by + bh - corner);
        ctx.lineTo(bx, by + bh);
        ctx.lineTo(bx + corner, by + bh);
        ctx.moveTo(bx + bw - corner, by + bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx + bw, by + bh - corner);
        ctx.stroke();

        const indexPrefix = detectedFaces.length > 1 ? `#${idx + 1} ` : '';
        const distBadge = formatDistanceCompact(face.distanceMeters);
        let tagText = `${indexPrefix}READY • ${distBadge}`;
        if (face.isRecognized && face.matchedFace) {
          tagText = `${indexPrefix}${face.matchedFace.name.toUpperCase()} (${face.matchConfidence}%) • ${distBadge}`;
        } else if (isEnrollTarget) {
          tagText = `#${idx + 1} TARGET • ${distBadge}`;
        } else if (hasEnrolled) {
          tagText = `${indexPrefix}UNKNOWN (${face.matchConfidence}%) • ${distBadge}`;
        }

        ctx.save();
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(tagText).width;
        const plateW = tw + 16;
        const plateH = 22;
        const plateY = Math.max(4, by - plateH - 4);
        const plateX = Math.max(4, Math.min(width - plateW - 4, bx));

        if (isMirrored) {
          ctx.translate(plateX + plateW / 2, plateY + plateH / 2);
          ctx.scale(-1, 1);
          ctx.translate(-(plateX + plateW / 2), -(plateY + plateH / 2));
        }

        ctx.fillStyle = 'rgba(7, 11, 20, 0.9)';
        ctx.fillRect(plateX, plateY, plateW, plateH);
        ctx.fillStyle = primaryColor;
        ctx.fillRect(plateX, plateY, 3, plateH);
        ctx.fillStyle = face.isRecognized ? '#34D399' : isEnrollTarget ? '#22D3EE' : hasEnrolled ? '#FBBF24' : '#22D3EE';
        ctx.fillText(tagText, plateX + 8, plateY + 15);
        ctx.restore();
      });

      ctx.restore();
    };

    const runFaceLoop = () => {
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
          if (faceService.isReady() && now - lastFrameDetectRef.current >= 33) {
            lastFrameDetectRef.current = now;
            const results = faceService.detectVideoFrame(video, facesRef.current);

            // Smooth biometric distance per detected face
            results.forEach((r, idx) => {
              const trackKey =
                r.isRecognized && r.matchedFace ? r.matchedFace.id : `face-${idx}`;
              const prevDist = smoothedDistancesRef.current.get(trackKey);
              const smoothed =
                prevDist !== undefined
                  ? prevDist * 0.65 + r.distanceMeters * 0.35
                  : r.distanceMeters;
              const formatted =
                smoothed < 1.0 ? Number(smoothed.toFixed(2)) : Number(smoothed.toFixed(1));
              smoothedDistancesRef.current.set(trackKey, formatted);
              r.distanceMeters = formatted;
            });

            allDetectedFacesRef.current = results;

            ctx.clearRect(0, 0, vw, vh);
            if (results.length > 0) {
              drawFacesOverlay(ctx, vw, vh, results, facingModeRef.current === 'user');
            }

            // Track consecutive frames per recognized ID & trigger voice name + distance announcement
            const visibleRecognizedIds = new Set<string>();
            const eligibleToAnnounce: Array<{ id: string; name: string; distanceMeters: number }> = [];

            for (const r of results) {
              if (r.isRecognized && r.matchedFace) {
                const fid = r.matchedFace.id;
                visibleRecognizedIds.add(fid);
                const prevCount = consecutiveMatchFramesRef.current.get(fid) || 0;
                const nextCount = prevCount + 1;
                consecutiveMatchFramesRef.current.set(fid, nextCount);

                const lastSpokenAt = lastSpokenByFaceIdRef.current.get(fid) || 0;
                if (nextCount >= 2 && now - lastSpokenAt > 7000) {
                  eligibleToAnnounce.push({
                    id: fid,
                    name: r.matchedFace.name,
                    distanceMeters: r.distanceMeters,
                  });
                }
              }
            }

            // Decay/clear streak counters for faces not currently visible
            for (const existingId of Array.from(consecutiveMatchFramesRef.current.keys())) {
              if (!visibleRecognizedIds.has(existingId)) {
                consecutiveMatchFramesRef.current.delete(existingId);
              }
            }

            if (
              voiceAnnounceRef.current &&
              eligibleToAnnounce.length > 0 &&
              now - lastGlobalSpeakTimeRef.current >= 2500
            ) {
              lastGlobalSpeakTimeRef.current = now;
              for (const item of eligibleToAnnounce) {
                lastSpokenByFaceIdRef.current.set(item.id, now);
              }
              playAudioFx.acknowledge();

              const names = eligibleToAnnounce.map((p) => p.name);
              const spokenPhrase =
                languageRef.current === 'hi'
                  ? eligibleToAnnounce.length === 1
                    ? `${eligibleToAnnounce[0].name} ${formatDistanceSpoken(eligibleToAnnounce[0].distanceMeters, 'hi')} की दूरी पर पहचाने गए हैं`
                    : `${eligibleToAnnounce
                        .map((p) => `${p.name} ${formatDistanceSpoken(p.distanceMeters, 'hi')} पर`)
                        .join(' और ')} की पहचान हो गई है`
                  : eligibleToAnnounce.length === 1
                  ? `${eligibleToAnnounce[0].name} detected at ${formatDistanceSpoken(eligibleToAnnounce[0].distanceMeters, 'en')}`
                  : `${eligibleToAnnounce
                      .map((p) => `${p.name} at ${formatDistanceSpoken(p.distanceMeters, 'en')}`)
                      .join(' and ')} detected`;

              setLastSpokenLabel(names.join(', '));
              speechService.speak(spokenPhrase);
            }

            // Sync React UI state smoothly (~5-8 times/sec or on count change)
            if (now - lastUiSyncRef.current >= 140 || results.length === 0) {
              lastUiSyncRef.current = now;
              setFacesCount(results.length);

              if (results.length > 0) {
                const primary = results.find((r) => r.isRecognized) || results[0];
                setHeadPoseInfo(`${primary.headPose.yaw} • ${primary.headPose.tiltDeg}°`);
                setPrimaryDistanceMeters(primary.distanceMeters);

                const matchedList = results
                  .filter((r) => r.isRecognized && r.matchedFace)
                  .map((r) => ({
                    id: r.matchedFace!.id,
                    name: r.matchedFace!.name,
                    role: r.matchedFace!.role,
                    confidence: r.matchConfidence,
                    distanceMeters: r.distanceMeters,
                  }));

                setRecognizedMatches(matchedList);
                setTopUnrecognizedConfidence(
                  matchedList.length === 0 ? primary.matchConfidence : 0
                );
                setLiveFaceSummaries(
                  results.map((r, index) => ({
                    index,
                    isRecognized: r.isRecognized,
                    name: r.matchedFace ? r.matchedFace.name : null,
                    confidence: r.matchConfidence,
                    distanceMeters: r.distanceMeters,
                  }))
                );
              } else {
                setRecognizedMatches([]);
                setLiveFaceSummaries([]);
                setPrimaryDistanceMeters(0);
                setTopUnrecognizedConfidence(0);
                setHeadPoseInfo('NO FACE IN FRAME');
              }
            }
          }
        }
      }

      loopRef.current = requestAnimationFrame(runFaceLoop);
    };

    loopRef.current = requestAnimationFrame(runFaceLoop);
    return () => {
      isRunning = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  const captureLivePortrait = (box: DetectedFaceResult['box']): string => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return '';
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = Math.max(0, box.x * vw - vw * 0.04);
    const sy = Math.max(0, box.y * vh - vh * 0.05);
    const sw = Math.max(16, Math.min(vw - sx, box.width * vw + vw * 0.08));
    const sh = Math.max(16, Math.min(vh - sy, box.height * vh + vh * 0.1));

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 128;
    snapCanvas.height = 128;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return '';
    if (facingMode === 'user') {
      ctx.translate(128, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 128, 128);
    return snapCanvas.toDataURL('image/jpeg', 0.72);
  };

  const handlePhotoUploadForEnroll = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    setFeedback('');

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const detectedInPhoto = await faceService.extractAllFacesFromImageUrl(dataUrl);
      if (detectedInPhoto.length === 0) {
        playAudioFx.alertSiren();
        setUploadedPhotoFaces([]);
        setFeedback(
          language === 'hi'
            ? 'इस फोटो में कोई चेहरा नहीं मिला। कृपया स्पष्ट सामने वाला चेहरा चुनें।'
            : 'No clear face detected in the uploaded photo. Please choose a clearer front-facing photo.'
        );
      } else {
        setUploadedPhotoFaces(detectedInPhoto);
        setSelectedPhotoFaceIndex(0);
        playAudioFx.scannerPing();
        setFeedback(
          language === 'hi'
            ? `फोटो में ${detectedInPhoto.length} चेहरा/चेहरे मिले। नाम लिखें और Save दबाएं।`
            : `Detected ${detectedInPhoto.length} face${detectedInPhoto.length > 1 ? 's' : ''} in photo. Select face, enter name, and save.`
        );
      }
    } catch {
      setFeedback('Could not process uploaded photo.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEnrollFace = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;

    let descriptor: number[] = [];
    let photoUrl = '';

    if (enrollSource === 'photo') {
      const targetPhotoFace =
        uploadedPhotoFaces[selectedPhotoFaceIndex] || uploadedPhotoFaces[0];
      if (!targetPhotoFace || targetPhotoFace.descriptor.length === 0) {
        playAudioFx.alertSiren();
        setFeedback(
          language === 'hi'
            ? 'पहले फोटो अपलोड करें जिसमें चेहरा साफ दिखे।'
            : 'Please upload a photo with a clear detected face first.'
        );
        return;
      }
      descriptor = targetPhotoFace.descriptor;
      photoUrl = targetPhotoFace.photoUrl;
    } else {
      const allLive = allDetectedFacesRef.current;
      const targetIdx = Math.min(selectedLiveFaceIndex, Math.max(0, allLive.length - 1));
      const liveFace = allLive[targetIdx];
      if (!liveFace || !liveFace.descriptor || liveFace.descriptor.length === 0) {
        playAudioFx.alertSiren();
        setFeedback(
          language === 'hi'
            ? 'कैमरे में कोई चेहरा नहीं मिला! कृपया कैमरे की ओर देखें और पुनः प्रयास करें।'
            : 'No live face mesh detected. Look at the camera until the face box locks on, then save.'
        );
        return;
      }
      descriptor = liveFace.descriptor;
      photoUrl = captureLivePortrait(liveFace.box);
    }

    const newFace: FaceEnrollment = {
      id: 'face-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: trimmedName,
      role: roleInput.trim() || 'Authorized User',
      photoUrl,
      descriptor,
      descriptors: [descriptor],
      confidenceThreshold: 0.9,
      enrolledAt: new Date().toLocaleDateString(),
    };

    const updated = [newFace, ...faces];
    setFaces(updated);
    storageService.saveFaceEnrollments(updated);
    lastSpokenByFaceIdRef.current.set(newFace.id, Date.now());
    lastGlobalSpeakTimeRef.current = Date.now();

    setIsEnrolling(false);
    setNameInput('');
    setUploadedPhotoFaces([]);
    setSelectedPhotoFaceIndex(0);
    setSelectedLiveFaceIndex(0);
    playAudioFx.acknowledge();

    const greet =
      language === 'hi'
        ? `${newFace.name} का चेहरा सफलतापूर्वक सेव हो गया है। अब पहचान होने पर नाम बोला जाएगा।`
        : `${newFace.name} enrolled. Nancy will now recognize and speak ${newFace.name}'s name automatically.`;
    setFeedback(greet);
    speechService.speak(greet);
  };

  const handleAddSampleToFace = (faceId: string) => {
    const allLive = allDetectedFacesRef.current;
    const targetIdx = Math.min(selectedLiveFaceIndex, Math.max(0, allLive.length - 1));
    const liveFace = allLive[targetIdx];

    if (!liveFace || !liveFace.descriptor || liveFace.descriptor.length === 0) {
      playAudioFx.alertSiren();
      setFeedback(
        language === 'hi'
          ? 'सैंपल जोड़ने के लिए कैमरे में चेहरा होना जरूरी है।'
          : 'Look at the camera to capture an extra angle sample for this profile.'
      );
      return;
    }

    const updated = faces.map((f) => {
      if (f.id !== faceId) return f;
      const existingList =
        Array.isArray(f.descriptors) && f.descriptors.length > 0
          ? f.descriptors
          : f.descriptor
          ? [f.descriptor]
          : [];
      const nextDescriptors = [...existingList, liveFace.descriptor].slice(-6);
      return {
        ...f,
        descriptor: f.descriptor || liveFace.descriptor,
        descriptors: nextDescriptors,
      };
    });

    setFaces(updated);
    storageService.saveFaceEnrollments(updated);
    playAudioFx.acknowledge();

    const target = updated.find((f) => f.id === faceId);
    const sampleCount = target?.descriptors?.length || 1;
    setFeedback(
      language === 'hi'
        ? `${target?.name} के लिए नया एंगल सैंपल जोड़ा गया (कुल ${sampleCount} सैंपल)।`
        : `Added extra angle sample for ${target?.name} (${sampleCount} samples active).`
    );
  };

  const handleDeleteFace = (id: string) => {
    playAudioFx.click();
    const updated = faces.filter((f) => f.id !== id);
    setFaces(updated);
    storageService.saveFaceEnrollments(updated);
  };

  const handleWipeAllBiometrics = () => {
    playAudioFx.alertSiren();
    setFaces([]);
    storageService.saveFaceEnrollments([]);
    setFeedback('All local biometric templates erased.');
  };

  const recognizedMatchMap = new Map(recognizedMatches.map((m) => [m.id, m]));
  const isAnyRecognized = recognizedMatches.length > 0;
  const recognizedNamesBanner = recognizedMatches
    .map((m) => `${m.name} (${m.confidence}% • ${formatDistanceCompact(m.distanceMeters)})`)
    .join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl bg-slate-950/95">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2 min-w-0">
            <UserCheck className="w-5 h-5 text-cyan-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="font-cyber font-bold text-sm text-cyan-300">
                  FACE INTELLIGENCE
                </h2>
                {modelStatus === 'ready' ? (
                  <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                    MULTI-FACE • {delegateName}
                  </span>
                ) : modelStatus === 'loading' ? (
                  <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse">
                    LOADING MESH...
                  </span>
                ) : (
                  <button
                    onClick={() => initFaceModel(true)}
                    className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 hover:bg-red-900"
                  >
                    ERROR • RETRY
                  </button>
                )}
              </div>
              <p className="text-[10px] font-tech text-slate-400 truncate">
                UP TO 6 FACES • AUTO VOICE NAME RECOGNITION
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => {
                playAudioFx.click();
                setVoiceAnnounceEnabled((prev) => {
                  const next = !prev;
                  if (!next) speechService.stopSpeaking();
                  return next;
                });
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors ${
                voiceAnnounceEnabled
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800/70 border-slate-700 text-slate-400'
              }`}
              title="Toggle automatic spoken name announcement on detection"
            >
              {voiceAnnounceEnabled ? (
                <Volume2 className="w-3 h-3" />
              ) : (
                <VolumeX className="w-3 h-3" />
              )}
              <span>VOICE</span>
            </button>

            <button
              onClick={() => {
                playAudioFx.click();
                setShowWireframeMesh(!showWireframeMesh);
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-mono-cyber flex items-center space-x-1 transition-colors ${
                showWireframeMesh
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800/70 border-slate-700 text-slate-400'
              }`}
              title="Toggle 468-point facial wireframe mesh"
            >
              <ScanFace className="w-3 h-3" />
              <span>MESH</span>
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

        {/* Video Canvas HUD */}
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
                    {language === 'hi' ? '468-पॉइंट फेस मेश लोड हो रहा है...' : 'LOADING 468-POINT FACE MESH...'}
                  </p>
                </div>
              )}

              {modelStatus === 'error' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-center">
                  <AlertTriangle className="w-7 h-7 text-amber-400 mb-2" />
                  <p className="text-xs font-cyber text-amber-300">FACE MESH FAILED TO LOAD</p>
                  {modelErrorMsg && <p className="text-[10px] text-slate-400 mt-1 max-w-xs">{modelErrorMsg}</p>}
                  <button
                    onClick={() => initFaceModel(true)}
                    className="mt-2.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech text-xs flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>RETRY LOAD</span>
                  </button>
                </div>
              )}

              {/* Top Telemetry */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
                <div className="bg-black/85 backdrop-blur-md px-2.5 py-1 rounded border border-cyan-500/30 text-[10px] font-mono-cyber text-cyan-300 flex items-center space-x-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      facesCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'
                    }`}
                  />
                  <span>
                    {facesCount > 0
                      ? `FACES: ${facesCount} • ${formatDistanceCompact(primaryDistanceMeters)} • ${headPoseInfo}`
                      : modelStatus === 'ready'
                      ? 'SCANNING FOR FACES...'
                      : 'INITIALIZING...'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {lastSpokenLabel && voiceAnnounceEnabled && (
                    <span className="bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/40 text-[10px] font-mono-cyber text-emerald-300 max-w-[140px] truncate">
                      SPOKE: {lastSpokenLabel}
                    </span>
                  )}
                  <span className="bg-black/80 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-mono-cyber text-slate-300">
                    {fps} FPS
                  </span>
                </div>
              </div>

              {/* Flip Camera Button */}
              <button
                onClick={() => {
                  playAudioFx.click();
                  setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
                }}
                className="absolute bottom-10 right-2 p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 backdrop-blur-md z-10"
                title="Switch Front/Rear Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Bottom Live Match Indicator */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/85 backdrop-blur-md px-3 py-1 rounded-lg border border-cyan-500/30 text-[10px] font-mono-cyber z-10">
                <span className="text-slate-200 flex items-center space-x-1.5 truncate">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isAnyRecognized
                        ? 'text-emerald-400'
                        : facesCount > 0
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  />
                  <span className="truncate">
                    {isAnyRecognized
                      ? `VERIFIED: ${recognizedNamesBanner}`
                      : facesCount > 0 && faces.length > 0
                      ? `UNKNOWN SUBJECT (${facesCount} • ${formatDistanceCompact(primaryDistanceMeters)})`
                      : facesCount > 0
                      ? `${facesCount} FACE${facesCount > 1 ? 'S' : ''} • ${formatDistanceCompact(primaryDistanceMeters)}`
                      : 'SCANNING CAMERA...'}
                  </span>
                </span>
                <span
                  className={`font-bold shrink-0 ml-2 ${
                    isAnyRecognized
                      ? 'text-emerald-400'
                      : facesCount > 0
                      ? 'text-amber-300'
                      : 'text-cyan-400'
                  }`}
                >
                  {isAnyRecognized
                    ? `${recognizedMatches.length} MATCHED`
                    : faces.length > 0 && facesCount > 0
                    ? `MATCH: ${topUnrecognizedConfidence}%`
                    : facesCount > 0
                    ? 'MESH LOCKED'
                    : '0%'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs">
          {feedback && (
            <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 font-mono-cyber text-cyan-300 text-xs">
              {feedback}
            </div>
          )}

          {/* Enrollment Form */}
          {isEnrolling ? (
            <form onSubmit={handleEnrollFace} className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-tech font-bold text-cyan-300 text-xs block">
                  ENROLL HUMAN FACE
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setEnrollSource('camera')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-cyber border ${
                      enrollSource === 'camera'
                        ? 'bg-cyan-900/80 border-cyan-400 text-cyan-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    LIVE CAMERA
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollSource('photo')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-cyber border ${
                      enrollSource === 'photo'
                        ? 'bg-cyan-900/80 border-cyan-400 text-cyan-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    UPLOAD PHOTO
                  </button>
                </div>
              </div>

              {enrollSource === 'camera' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono-cyber text-slate-400">
                      {facesCount > 1
                        ? `Detected ${facesCount} faces — tap which face to enroll:`
                        : facesCount === 1
                        ? 'Face locked in camera frame'
                        : 'Look directly at the camera'}
                    </span>
                    <span
                      className={`text-[10px] font-mono-cyber px-2 py-0.5 rounded ${
                        facesCount > 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {facesCount > 0 ? `${facesCount} LOCKED` : 'WAITING'}
                    </span>
                  </div>

                  {liveFaceSummaries.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {liveFaceSummaries.map((item) => (
                        <button
                          key={item.index}
                          type="button"
                          onClick={() => setSelectedLiveFaceIndex(item.index)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono-cyber border transition-colors ${
                            selectedLiveFaceIndex === item.index
                              ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 font-bold'
                              : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          Face #{item.index + 1}
                          {item.isRecognized && item.name ? ` (${item.name})` : ' (New)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUploadForEnroll}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isProcessingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-dashed border-cyan-500/50 text-cyan-300 font-mono-cyber text-[11px] flex items-center justify-center space-x-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isProcessingPhoto
                        ? 'ANALYZING PHOTO...'
                        : 'SELECT PHOTO (SOLO OR GROUP)'}
                    </span>
                  </button>

                  {uploadedPhotoFaces.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedPhotoFaces.map((pf, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPhotoFaceIndex(idx)}
                          className={`flex items-center space-x-1.5 p-1 rounded-lg border ${
                            selectedPhotoFaceIndex === idx
                              ? 'border-cyan-400 bg-cyan-950/60'
                              : 'border-slate-700 bg-slate-950'
                          }`}
                        >
                          {pf.photoUrl && (
                            <img
                              src={pf.photoUrl}
                              alt={`Face ${idx + 1}`}
                              className="w-8 h-8 rounded object-cover"
                            />
                          )}
                          <span className="text-[10px] font-mono-cyber text-slate-200 pr-1">
                            Face #{idx + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-400 font-mono-cyber block mb-1">
                  Human Name (spoken aloud when detected)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Rahul / Kunddan / Priya"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono-cyber block mb-1">
                  Role / Relation
                </label>
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  placeholder="Admin / Family / Friend / Guest"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="submit"
                  disabled={
                    enrollSource === 'camera'
                      ? facesCount === 0
                      : uploadedPhotoFaces.length === 0
                  }
                  className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-tech font-bold tracking-wider transition-colors"
                >
                  SAVE FACE PROFILE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEnrolling(false);
                    setUploadedPhotoFaces([]);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-tech"
                >
                  CANCEL
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  playAudioFx.click();
                  setFeedback('');
                  setEnrollSource('camera');
                  setIsEnrolling(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-900/30"
              >
                <UserPlus className="w-4 h-4" />
                <span>ENROLL NEW FACE ({faces.length})</span>
              </button>
              {faces.length > 0 && (
                <button
                  onClick={handleWipeAllBiometrics}
                  className="p-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 transition-colors"
                  title="Wipe All Biometrics"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Enrolled Faces List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-tech font-bold text-slate-300 text-xs tracking-wider">
                ENROLLED PROFILES ({faces.length})
              </span>
              {faces.length > 0 && (
                <span className="text-[10px] font-mono-cyber text-slate-400">
                  Tip: Use + to add extra angles
                </span>
              )}
            </div>

            {faces.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-500 text-center italic">
                No faces enrolled yet. Tap "Enroll New Face" to register one or more humans — their name will be spoken aloud whenever recognized.
              </div>
            ) : (
              <div className="space-y-2">
                {faces.map((f) => {
                  const matchedEntry = recognizedMatchMap.get(f.id);
                  const isMatched = Boolean(matchedEntry);
                  const sampleCount =
                    Array.isArray(f.descriptors) && f.descriptors.length > 0
                      ? f.descriptors.length
                      : f.descriptor?.length
                      ? 1
                      : 0;
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        isMatched
                          ? 'bg-emerald-950/35 border-emerald-500/60'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {f.photoUrl ? (
                          <img
                            src={f.photoUrl}
                            alt={f.name}
                            className="w-10 h-10 rounded-lg object-cover border border-cyan-400/40 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-cyan-950 flex items-center justify-center border border-cyan-500/30 text-cyan-400 font-cyber font-bold shrink-0">
                            {f.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-tech font-bold text-slate-100 text-sm flex items-center space-x-2">
                            <span className="truncate">{f.name}</span>
                            {matchedEntry && (
                              <span className="text-[9px] font-mono-cyber px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                                ACTIVE • {formatDistanceCompact(matchedEntry.distanceMeters)}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono-cyber text-cyan-400 truncate">
                            {f.role} • {sampleCount > 0 ? `${sampleCount} Mesh Sample${sampleCount > 1 ? 's' : ''}` : 'Photo Only'} • {f.enrolledAt}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleAddSampleToFace(f.id)}
                          disabled={facesCount === 0}
                          className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-950/60 disabled:text-slate-600 disabled:hover:bg-transparent transition-colors"
                          title="Add another live camera angle sample for this person"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFace(f.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                          title="Remove profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
