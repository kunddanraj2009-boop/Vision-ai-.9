import { FilesetResolver, FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FaceEnrollment } from '../types/nancy';

export interface FaceBoxNormalized {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFaceResult {
  landmarks: NormalizedLandmark[];
  box: FaceBoxNormalized;
  descriptor: number[];
  matchedFace: FaceEnrollment | null;
  matchConfidence: number; // 0 - 100
  isRecognized: boolean;
  distanceMeters: number;
  headPose: {
    yaw: 'CENTER' | 'LEFT' | 'RIGHT';
    tiltDeg: number;
  };
}

export interface ExtractedPhotoFace {
  descriptor: number[];
  box: FaceBoxNormalized;
  photoUrl: string;
}

export const FACE_CONNECTIONS = {
  TESSELATION: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
  FACE_OVAL: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  LEFT_EYE: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  RIGHT_EYE: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  LEFT_EYEBROW: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  RIGHT_EYEBROW: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  LEFT_IRIS: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
  RIGHT_IRIS: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  LIPS: FaceLandmarker.FACE_LANDMARKS_LIPS,
};

class FaceIntelligenceManager {
  private videoLandmarker: FaceLandmarker | null = null;
  private imageLandmarker: FaceLandmarker | null = null;
  private isLoading = false;
  private loadPromise: Promise<FaceLandmarker | null> | null = null;
  private imageLoadPromise: Promise<FaceLandmarker | null> | null = null;
  private lastError: string | null = null;
  private delegateName: 'GPU' | 'CPU' = 'GPU';
  private lastTimestamp = 0;
  private captureCanvas: HTMLCanvasElement | null = null;
  private wasmCache: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
  private resolvedModelPath: string | null = null;

  public isReady(): boolean {
    return Boolean(this.videoLandmarker);
  }

  public isInitializing(): boolean {
    return this.isLoading;
  }

  public getDelegate(): string {
    return this.delegateName;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async fetchModelBuffer(url: string, timeoutMs = 12000): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching face model`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } finally {
      clearTimeout(timer);
    }
  }

  private async getWasmFileset() {
    if (this.wasmCache) return this.wasmCache;
    try {
      this.wasmCache = await this.withTimeout(
        FilesetResolver.forVisionTasks('/mediapipe-wasm'),
        6000,
        'Face WASM resolver'
      );
    } catch {
      this.wasmCache = await this.withTimeout(
        FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        ),
        8000,
        'Face CDN WASM resolver'
      );
    }
    return this.wasmCache;
  }

  public async initialize(forceReload = false): Promise<FaceLandmarker | null> {
    if (this.videoLandmarker && !forceReload) return this.videoLandmarker;
    if (this.loadPromise && !forceReload) return this.loadPromise;

    if (forceReload) {
      if (this.videoLandmarker) {
        try {
          this.videoLandmarker.close();
        } catch {}
        this.videoLandmarker = null;
      }
      this.loadPromise = null;
    }

    this.isLoading = true;
    this.lastError = null;

    this.loadPromise = (async () => {
      try {
        const visionWasm = await this.getWasmFileset();
        const localModelUrl = `${window.location.origin}/api/models/mediapipe/face_landmarker.task`;
        const remoteModelUrl =
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

        let modelBytes: Uint8Array | null = null;
        try {
          modelBytes = await this.fetchModelBuffer(localModelUrl, 12000);
          this.resolvedModelPath = localModelUrl;
        } catch {
          try {
            modelBytes = await this.fetchModelBuffer(remoteModelUrl, 12000);
            this.resolvedModelPath = remoteModelUrl;
          } catch {
            modelBytes = null;
          }
        }

        const createWithOptions = async (
          delegate: 'GPU' | 'CPU',
          useRemoteUrlFallback = false
        ) => {
          const baseOptions: any = modelBytes
            ? { modelAssetBuffer: modelBytes.slice(0), delegate }
            : {
                modelAssetPath: useRemoteUrlFallback ? remoteModelUrl : localModelUrl,
                delegate,
              };

          return await this.withTimeout(
            FaceLandmarker.createFromOptions(visionWasm, {
              baseOptions,
              runningMode: 'VIDEO',
              numFaces: 6,
              minFaceDetectionConfidence: 0.42,
              minFacePresenceConfidence: 0.42,
              minTrackingConfidence: 0.42,
              outputFaceBlendshapes: false,
              outputFacialTransformationMatrixes: false,
            }),
            delegate === 'GPU' ? 4500 : 9000,
            `FaceLandmarker(${delegate})`
          );
        };

        let instance: FaceLandmarker | null = null;
        try {
          instance = await createWithOptions('GPU');
          this.delegateName = 'GPU';
        } catch (gpuErr) {
          console.warn('[FaceAI] GPU init failed/timed out, using CPU delegate:', gpuErr);
          try {
            instance = await createWithOptions('CPU');
            this.delegateName = 'CPU';
          } catch (cpuLocalErr) {
            console.warn('[FaceAI] Retrying CPU with remote model path:', cpuLocalErr);
            instance = await createWithOptions('CPU', true);
            this.delegateName = 'CPU';
            this.resolvedModelPath = remoteModelUrl;
          }
        }

        this.videoLandmarker = instance;
        this.isLoading = false;
        this.lastError = null;
        console.log(`[FaceAI] MediaPipe FaceLandmarker ready (${this.delegateName}).`);
        return instance;
      } catch (err: any) {
        const msg = err?.message || 'Failed to initialize MediaPipe Face Landmarker.';
        console.error('[FaceAI] Initialization error:', err);
        this.lastError = msg;
        this.isLoading = false;
        this.loadPromise = null;
        return null;
      }
    })();

    return this.loadPromise;
  }

  private async getImageLandmarker(): Promise<FaceLandmarker | null> {
    if (this.imageLandmarker) return this.imageLandmarker;
    if (this.imageLoadPromise) return this.imageLoadPromise;

    this.imageLoadPromise = (async () => {
      try {
        const visionWasm = await this.getWasmFileset();
        const modelAssetPath =
          this.resolvedModelPath || `${window.location.origin}/api/models/mediapipe/face_landmarker.task`;
        this.imageLandmarker = await this.withTimeout(
          FaceLandmarker.createFromOptions(visionWasm, {
            baseOptions: {
              modelAssetPath,
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            numFaces: 6,
            minFaceDetectionConfidence: 0.38,
            minFacePresenceConfidence: 0.38,
          }),
          8000,
          'FaceImageLandmarker'
        );
        return this.imageLandmarker;
      } catch {
        this.imageLoadPromise = null;
        return null;
      }
    })();

    return this.imageLoadPromise;
  }

  private dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private dist3D(a: NormalizedLandmark, b: NormalizedLandmark): number {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.55);
  }

  /**
   * Computes a translation-, scale-, and 2D-rotation-invariant 3D geometric biometric vector
   * from MediaPipe's 468+ facial landmarks.
   */
  public extractDescriptor(lm: NormalizedLandmark[]): number[] {
    if (!lm || lm.length < 468) return [];

    // Eye centers (outer+inner corners) for scale and roll normalization
    const rEyeOuter = lm[33];
    const rEyeInner = lm[133];
    const lEyeInner = lm[362];
    const lEyeOuter = lm[263];

    const rEyeCenter: NormalizedLandmark = {
      x: (rEyeOuter.x + rEyeInner.x) / 2,
      y: (rEyeOuter.y + rEyeInner.y) / 2,
      z: (rEyeOuter.z + rEyeInner.z) / 2,
      visibility: 1,
    };
    const lEyeCenter: NormalizedLandmark = {
      x: (lEyeOuter.x + lEyeInner.x) / 2,
      y: (lEyeOuter.y + lEyeInner.y) / 2,
      z: (lEyeOuter.z + lEyeInner.z) / 2,
      visibility: 1,
    };

    const iod = Math.max(0.02, this.dist2D(rEyeCenter, lEyeCenter)); // Inter-ocular distance
    const eyeMidX = (rEyeCenter.x + lEyeCenter.x) / 2;
    const eyeMidY = (rEyeCenter.y + lEyeCenter.y) / 2;
    const eyeMidZ = (rEyeCenter.z + lEyeCenter.z) / 2;

    // Roll angle to align eye axis horizontally
    const angle = Math.atan2(lEyeCenter.y - rEyeCenter.y, lEyeCenter.x - rEyeCenter.x);
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    const normalizePt = (p: NormalizedLandmark) => {
      const dx = (p.x - eyeMidX) / iod;
      const dy = (p.y - eyeMidY) / iod;
      const dz = (p.z - eyeMidZ) / iod;
      return {
        x: dx * cosA - dy * sinA,
        y: dx * sinA + dy * cosA,
        z: dz,
      };
    };

    // Anatomical ratio features normalized by inter-ocular distance (IOD)
    const rEyeWidth = this.dist3D(lm[33], lm[133]) / iod;
    const lEyeWidth = this.dist3D(lm[362], lm[263]) / iod;
    const innerEyeGap = this.dist3D(lm[133], lm[362]) / iod;
    const outerEyeSpan = this.dist3D(lm[33], lm[263]) / iod;

    const noseLength = this.dist3D(lm[168], lm[1]) / iod;
    const noseBridgeHeight = this.dist3D(lm[6], lm[4]) / iod;
    const noseWidth = this.dist3D(lm[98], lm[327]) / iod;

    const mouthWidth = this.dist3D(lm[61], lm[291]) / iod;
    const noseToMouth = this.dist3D(lm[1], lm[0]) / iod;
    const noseToChin = this.dist3D(lm[1], lm[152]) / iod;
    const mouthToChin = this.dist3D(lm[17], lm[152]) / iod;

    const faceHeight = this.dist3D(lm[10], lm[152]) / iod;
    const foreheadHeight = this.dist3D(lm[10], lm[168]) / iod;
    const cheekWidth = this.dist3D(lm[234], lm[454]) / iod;
    const midCheekWidth = this.dist3D(lm[93], lm[323]) / iod;
    const jawWidth = this.dist3D(lm[172], lm[397]) / iod;
    const chinWidth = this.dist3D(lm[149], lm[378]) / iod;

    const rBrowHeight = this.dist3D(lm[105], rEyeCenter) / iod;
    const lBrowHeight = this.dist3D(lm[334], lEyeCenter) / iod;
    const browInnerGap = this.dist3D(lm[107], lm[336]) / iod;

    const rEyeToMouthCorner = this.dist3D(rEyeCenter, lm[61]) / iod;
    const lEyeToMouthCorner = this.dist3D(lEyeCenter, lm[291]) / iod;
    const rCheekToChin = this.dist3D(lm[234], lm[152]) / iod;
    const lCheekToChin = this.dist3D(lm[454], lm[152]) / iod;
    const rJawToChin = this.dist3D(lm[172], lm[152]) / iod;
    const lJawToChin = this.dist3D(lm[397], lm[152]) / iod;

    // 3D depth prominence ratios (nose tip protrusion vs cheeks & brow)
    const noseTipDepth = normalizePt(lm[4]).z;
    const chinDepth = normalizePt(lm[152]).z;
    const cheekDepthAvg = (normalizePt(lm[234]).z + normalizePt(lm[454]).z) / 2;

    // Composite proportion invariants (immune to slight yaw/pitch)
    const rawFeatures = [
      (rEyeWidth + lEyeWidth) / 2,
      innerEyeGap,
      outerEyeSpan,
      noseLength,
      noseBridgeHeight,
      noseWidth,
      mouthWidth,
      noseToMouth,
      noseToChin,
      mouthToChin,
      faceHeight,
      foreheadHeight,
      cheekWidth,
      midCheekWidth,
      jawWidth,
      chinWidth,
      (rBrowHeight + lBrowHeight) / 2,
      browInnerGap,
      (rEyeToMouthCorner + lEyeToMouthCorner) / 2,
      (rCheekToChin + lCheekToChin) / 2,
      (rJawToChin + lJawToChin) / 2,
      cheekWidth / Math.max(0.2, faceHeight),
      jawWidth / Math.max(0.2, cheekWidth),
      noseWidth / Math.max(0.2, mouthWidth),
      mouthWidth / Math.max(0.2, jawWidth),
      noseTipDepth - cheekDepthAvg,
      chinDepth - cheekDepthAvg,
    ];

    return rawFeatures.map((v) => Number(v.toFixed(4)));
  }

  private getProfileDescriptors(face: FaceEnrollment, expectedLength: number): number[][] {
    const list: number[][] = [];
    if (Array.isArray(face.descriptors)) {
      for (const d of face.descriptors) {
        if (Array.isArray(d) && d.length === expectedLength) {
          list.push(d);
        }
      }
    }
    if (Array.isArray(face.descriptor) && face.descriptor.length === expectedLength) {
      if (!list.some((d) => d === face.descriptor)) {
        list.push(face.descriptor);
      }
    }
    return list;
  }

  public async extractAllFacesFromImageUrl(dataUrl: string): Promise<ExtractedPhotoFace[]> {
    if (!dataUrl) return [];
    try {
      const landmarker = await this.getImageLandmarker();
      if (!landmarker) return [];

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });

      const res = landmarker.detect(img);
      if (!res.faceLandmarks || res.faceLandmarks.length === 0) {
        return [];
      }

      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;

      const sortedLandmarks = [...res.faceLandmarks].sort((a, b) => {
        const boxA = this.computeFaceBox(a);
        const boxB = this.computeFaceBox(b);
        return boxA.x - boxB.x;
      });

      return sortedLandmarks
        .map((lm) => {
          const descriptor = this.extractDescriptor(lm);
          const box = this.computeFaceBox(lm);
          let photoUrl = '';
          try {
            const sx = Math.max(0, box.x * iw - iw * 0.04);
            const sy = Math.max(0, box.y * ih - ih * 0.05);
            const sw = Math.max(16, Math.min(iw - sx, box.width * iw + iw * 0.08));
            const sh = Math.max(16, Math.min(ih - sy, box.height * ih + ih * 0.1));
            const snapCanvas = document.createElement('canvas');
            snapCanvas.width = 128;
            snapCanvas.height = 128;
            const ctx = snapCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 128, 128);
              photoUrl = snapCanvas.toDataURL('image/jpeg', 0.72);
            }
          } catch {}
          return { descriptor, box, photoUrl };
        })
        .filter((item) => item.descriptor.length > 0);
    } catch {
      return [];
    }
  }

  public async extractDescriptorFromImageUrl(dataUrl: string): Promise<number[] | null> {
    const faces = await this.extractAllFacesFromImageUrl(dataUrl);
    return faces.length > 0 ? faces[0].descriptor : null;
  }

  private computeSimilarity(a: number[], b: number[]): number {
    let sumSq = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
    }
    const l2 = Math.sqrt(sumSq);
    return Math.exp(-l2 * 0.58);
  }

  private rankFaceMatches(
    descriptor: number[],
    enrolledFaces: FaceEnrollment[]
  ): Array<{ face: FaceEnrollment; matchConfidence: number }> {
    if (descriptor.length === 0) return [];
    const ranked: Array<{ face: FaceEnrollment; matchConfidence: number }> = [];

    for (const face of enrolledFaces) {
      const descriptors = this.getProfileDescriptors(face, descriptor.length);
      if (descriptors.length === 0) continue;

      let bestSimilarity = 0;
      for (const target of descriptors) {
        const sim = this.computeSimilarity(descriptor, target);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
        }
      }
      ranked.push({
        face,
        matchConfidence: Number((bestSimilarity * 100).toFixed(1)),
      });
    }

    ranked.sort((a, b) => b.matchConfidence - a.matchConfidence);
    return ranked;
  }

  public matchFace(
    descriptor: number[],
    enrolledFaces: FaceEnrollment[]
  ): { matchedFace: FaceEnrollment | null; matchConfidence: number; isRecognized: boolean } {
    const ranked = this.rankFaceMatches(descriptor, enrolledFaces);
    if (ranked.length === 0) {
      return { matchedFace: null, matchConfidence: 0, isRecognized: false };
    }

    const best = ranked[0];
    const minAccept = Math.min(80, Math.max(68, best.face.confidenceThreshold * 80));

    if (best.matchConfidence >= minAccept) {
      return {
        matchedFace: best.face,
        matchConfidence: best.matchConfidence,
        isRecognized: true,
      };
    }

    return {
      matchedFace: null,
      matchConfidence: best.matchConfidence,
      isRecognized: false,
    };
  }

  /**
   * Estimates real-world distance from camera to face (in meters) using pinhole optics
   * combined with anatomical constants:
   * - Inter-Pupillary Distance (IPD ≈ 63 mm) with head-yaw cos compensation
   * - Human Iris Diameter (≈ 11.7 mm, when 478 iris landmarks are present & close range)
   * - Glabella-to-Chin structural height (≈ 122 mm, yaw-invariant)
   */
  public estimateFaceDistanceMeters(
    lm: NormalizedLandmark[],
    frameW: number,
    frameH: number
  ): number {
    if (!lm || lm.length < 468 || frameW <= 0 || frameH <= 0) {
      return 1.0;
    }

    // Standard camera focal length in pixels (~60° FOV along major sensor axis)
    const focalPx = Math.max(frameW, frameH) * 0.88;

    // Yaw foreshortening compensation factor [0.65 .. 1.0]
    const leftCheek = lm[234];
    const rightCheek = lm[454];
    const nose = lm[1];
    const faceSpan = Math.max(0.01, Math.abs(rightCheek.x - leftCheek.x));
    const noseOffset = (nose.x - leftCheek.x) / faceSpan;
    const yawRad = Math.min(0.85, Math.abs(noseOffset - 0.5) * 2.2);
    const cosYaw = Math.max(0.65, Math.cos(yawRad));

    // 1. Inter-Pupillary Distance (63 mm average adult/adolescent)
    const hasIris = lm.length >= 478;
    const rPupil = hasIris
      ? lm[468]
      : { x: (lm[33].x + lm[133].x) / 2, y: (lm[33].y + lm[133].y) / 2 };
    const lPupil = hasIris
      ? lm[473]
      : { x: (lm[362].x + lm[263].x) / 2, y: (lm[362].y + lm[263].y) / 2 };

    const rawIpdPx = Math.hypot(
      (lPupil.x - rPupil.x) * frameW,
      (lPupil.y - rPupil.y) * frameH
    );
    const correctedIpdPx = Math.max(6, rawIpdPx / cosYaw);
    const distByIpd = (0.063 * focalPx) / correctedIpdPx;

    // 2. Glabella-to-chin vertical structural distance (~122 mm, invariant to left/right yaw)
    const coreFacePx = Math.max(
      10,
      Math.hypot((lm[152].x - lm[168].x) * frameW, (lm[152].y - lm[168].y) * frameH)
    );
    const distByCore = (0.122 * focalPx) / coreFacePx;

    // 3. Iris diameter (~11.7 mm) when eye landmarks are clear & reasonably close
    let distMeters: number;
    let avgIrisPx = 0;
    if (hasIris) {
      const rHoriz = Math.hypot((lm[471].x - lm[469].x) * frameW, (lm[471].y - lm[469].y) * frameH);
      const rVert = Math.hypot((lm[472].x - lm[470].x) * frameW, (lm[472].y - lm[470].y) * frameH);
      const lHoriz = Math.hypot((lm[476].x - lm[474].x) * frameW, (lm[476].y - lm[474].y) * frameH);
      const lVert = Math.hypot((lm[477].x - lm[475].x) * frameW, (lm[477].y - lm[475].y) * frameH);
      const rIris = rVert > rHoriz * 0.65 ? (rHoriz + rVert) / 2 : rHoriz;
      const lIris = lVert > lHoriz * 0.65 ? (lHoriz + lVert) / 2 : lHoriz;
      avgIrisPx = (rIris + lIris) / 2;
    }

    if (avgIrisPx >= 7.5) {
      const distByIris = (0.0117 * focalPx) / avgIrisPx;
      distMeters = distByIpd * 0.5 + distByIris * 0.3 + distByCore * 0.2;
    } else {
      distMeters = distByIpd * 0.65 + distByCore * 0.35;
    }

    const clamped = Math.max(0.2, Math.min(8.0, distMeters));
    return clamped < 1.0 ? Number(clamped.toFixed(2)) : Number(clamped.toFixed(1));
  }

  private computeHeadPose(lm: NormalizedLandmark[]): { yaw: 'CENTER' | 'LEFT' | 'RIGHT'; tiltDeg: number } {
    const leftCheek = lm[234];
    const rightCheek = lm[454];
    const nose = lm[1];
    const rEye = lm[33];
    const lEye = lm[263];

    const faceSpan = Math.max(0.01, Math.abs(rightCheek.x - leftCheek.x));
    const noseOffset = (nose.x - leftCheek.x) / faceSpan; // ~0.5 when centered

    let yaw: 'CENTER' | 'LEFT' | 'RIGHT' = 'CENTER';
    if (noseOffset < 0.36) yaw = 'LEFT';
    else if (noseOffset > 0.64) yaw = 'RIGHT';

    const tiltDeg = Math.round((Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x) * 180) / Math.PI);
    return { yaw, tiltDeg };
  }

  private computeFaceBox(lm: NormalizedLandmark[]): FaceBoxNormalized {
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < lm.length; i++) {
      const p = lm[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.1;
    const x = Math.max(0, minX - padX);
    const y = Math.max(0, minY - padY);
    const w = Math.min(1 - x, maxX - minX + padX * 2);
    const h = Math.min(1 - y, maxY - minY + padY * 2);
    return { x, y, width: w, height: h };
  }

  public detectVideoFrame(
    video: HTMLVideoElement,
    enrolledFaces: FaceEnrollment[]
  ): DetectedFaceResult[] {
    if (
      !this.videoLandmarker ||
      !video ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return [];
    }

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.min(1, 512 / Math.max(vw, vh));
      const tw = Math.max(64, Math.round(vw * scale));
      const th = Math.max(64, Math.round(vh * scale));

      if (!this.captureCanvas) {
        this.captureCanvas = document.createElement('canvas');
      }
      if (this.captureCanvas.width !== tw || this.captureCanvas.height !== th) {
        this.captureCanvas.width = tw;
        this.captureCanvas.height = th;
      }

      const ctx = this.captureCanvas.getContext('2d');
      let sourceInput: HTMLVideoElement | HTMLCanvasElement = video;
      if (ctx) {
        ctx.drawImage(video, 0, 0, tw, th);
        sourceInput = this.captureCanvas;
      }

      const nowMs = Math.round(performance.now());
      this.lastTimestamp = Math.max(nowMs, this.lastTimestamp + 1);

      const res = this.videoLandmarker.detectForVideo(sourceInput, this.lastTimestamp);
      if (!res || !res.faceLandmarks || res.faceLandmarks.length === 0) {
        return [];
      }

      const rawFaces = res.faceLandmarks
        .map((landmarks) => ({
          landmarks,
          descriptor: this.extractDescriptor(landmarks),
          box: this.computeFaceBox(landmarks),
          headPose: this.computeHeadPose(landmarks),
          distanceMeters: this.estimateFaceDistanceMeters(landmarks, vw, vh),
        }))
        .sort((a, b) => a.box.x - b.box.x);

      // Rank all candidate pairs and greedily assign unique enrolled identities per frame
      const rankedPerFace = rawFaces.map((f) => this.rankFaceMatches(f.descriptor, enrolledFaces));
      const allPairs: Array<{ faceIdx: number; face: FaceEnrollment; matchConfidence: number }> = [];
      rankedPerFace.forEach((ranked, faceIdx) => {
        for (const cand of ranked) {
          const minAccept = Math.min(80, Math.max(68, cand.face.confidenceThreshold * 80));
          if (cand.matchConfidence >= minAccept) {
            allPairs.push({
              faceIdx,
              face: cand.face,
              matchConfidence: cand.matchConfidence,
            });
          }
        }
      });
      allPairs.sort((a, b) => b.matchConfidence - a.matchConfidence);

      const assignedFaceIndices = new Set<number>();
      const usedProfileIds = new Set<string>();
      const assignedMatch = new Map<number, { matchedFace: FaceEnrollment; matchConfidence: number }>();

      for (const pair of allPairs) {
        if (assignedFaceIndices.has(pair.faceIdx) || usedProfileIds.has(pair.face.id)) {
          continue;
        }
        assignedFaceIndices.add(pair.faceIdx);
        usedProfileIds.add(pair.face.id);
        assignedMatch.set(pair.faceIdx, {
          matchedFace: pair.face,
          matchConfidence: pair.matchConfidence,
        });
      }

      return rawFaces.map((item, idx) => {
        const assigned = assignedMatch.get(idx);
        const topConfidence = rankedPerFace[idx]?.[0]?.matchConfidence ?? 0;
        return {
          landmarks: item.landmarks,
          box: item.box,
          descriptor: item.descriptor,
          matchedFace: assigned ? assigned.matchedFace : null,
          matchConfidence: assigned ? assigned.matchConfidence : topConfidence,
          isRecognized: Boolean(assigned),
          distanceMeters: item.distanceMeters,
          headPose: item.headPose,
        };
      });
    } catch (err) {
      console.warn('[FaceAI] Frame detection error:', err);
      return [];
    }
  }
}

export const faceService = new FaceIntelligenceManager();
