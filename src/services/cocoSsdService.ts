import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { RecognizedObject } from '../types/nancy';

export type DetectedClassCategory =
  | 'human'
  | 'vehicle'
  | 'furniture'
  | 'electronics'
  | 'animal'
  | 'kitchen'
  | 'accessory'
  | 'general';

export interface CocoDetection {
  id: string;
  class: string;
  displayName: string;
  displayNameHi: string;
  category: DetectedClassCategory;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  estimatedDistanceMeters: number;
  color: string;
  source?: 'coco' | 'gemini_vision';
}

// Category color palettes for cybernetic HUD
export const CATEGORY_COLORS: Record<DetectedClassCategory, { border: string; bg: string; text: string }> = {
  human: { border: '#10B981', bg: 'rgba(16, 185, 129, 0.22)', text: '#34D399' },
  vehicle: { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.22)', text: '#FBBF24' },
  furniture: { border: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.22)', text: '#A78BFA' },
  electronics: { border: '#06B6D4', bg: 'rgba(6, 182, 212, 0.22)', text: '#22D3EE' },
  animal: { border: '#F43F5E', bg: 'rgba(244, 63, 94, 0.22)', text: '#FB7185' },
  kitchen: { border: '#EAB308', bg: 'rgba(234, 179, 8, 0.22)', text: '#FDE047' },
  accessory: { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.22)', text: '#60A5FA' },
  general: { border: '#94A3B8', bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1' },
};

interface ClassMeta {
  displayName: string;
  displayNameHi: string;
  category: DetectedClassCategory;
  realWidthMeters: number;
  realHeightMeters: number;
}

const COCO_CLASS_META: Record<string, [string, string, DetectedClassCategory, number, number]> = {
  person: ['Human / Person', 'इंसान / व्यक्ति', 'human', 0.48, 1.68],
  bicycle: ['Bicycle', 'साइकिल', 'vehicle', 1.65, 1.05],
  car: ['Car', 'कार', 'vehicle', 1.82, 1.48],
  motorcycle: ['Motorcycle', 'मोटरसाइकिल / बाइक', 'vehicle', 0.80, 1.12],
  airplane: ['Airplane', 'हवाई जहाज', 'vehicle', 28.0, 9.0],
  bus: ['Bus', 'बस', 'vehicle', 2.55, 3.10],
  train: ['Train', 'ट्रेन', 'vehicle', 3.00, 3.80],
  truck: ['Truck', 'ट्रक', 'vehicle', 2.45, 2.85],
  boat: ['Boat', 'नाव', 'vehicle', 2.20, 1.20],
  'traffic light': ['Traffic Light', 'ट्रैफिक लाइट', 'general', 0.35, 0.90],
  'fire hydrant': ['Fire Hydrant', 'फायर हाइड्रेंट', 'general', 0.35, 0.75],
  'stop sign': ['Stop Sign', 'स्टॉप साइन', 'general', 0.75, 0.75],
  'parking meter': ['Parking Meter', 'पार्किंग मीटर', 'general', 0.25, 1.20],
  bench: ['Bench', 'बेंच', 'furniture', 1.50, 0.82],
  bird: ['Bird', 'पक्षी', 'animal', 0.22, 0.22],
  cat: ['Cat', 'बिल्ली', 'animal', 0.42, 0.30],
  dog: ['Dog', 'कुत्ता', 'animal', 0.65, 0.55],
  horse: ['Horse', 'घोड़ा', 'animal', 2.10, 1.60],
  sheep: ['Sheep', 'भेड़', 'animal', 1.00, 0.75],
  cow: ['Cow', 'गाय', 'animal', 2.10, 1.45],
  elephant: ['Elephant', 'हाथी', 'animal', 3.60, 2.80],
  bear: ['Bear', 'भालू', 'animal', 1.80, 1.20],
  zebra: ['Zebra', 'ज़ेबरा', 'animal', 2.00, 1.40],
  giraffe: ['Giraffe', 'जिराफ', 'animal', 1.80, 4.50],
  backpack: ['Backpack / Bag', 'बैग / बस्ता', 'accessory', 0.33, 0.45],
  umbrella: ['Umbrella', 'छाता', 'accessory', 0.95, 0.75],
  handbag: ['Handbag', 'हैंडबैग / पर्स', 'accessory', 0.34, 0.28],
  tie: ['Necktie', 'टाई', 'accessory', 0.10, 0.48],
  suitcase: ['Suitcase / Luggage', 'सूटकेस', 'accessory', 0.48, 0.68],
  frisbee: ['Frisbee', 'फ्रिसबी', 'general', 0.27, 0.27],
  skis: ['Skis', 'स्की', 'general', 0.12, 1.65],
  snowboard: ['Snowboard', 'स्नोबोर्ड', 'general', 0.28, 1.50],
  'sports ball': ['Ball', 'गेंद / बॉल', 'general', 0.22, 0.22],
  kite: ['Kite', 'पतंग', 'general', 0.85, 0.85],
  'baseball bat': ['Bat', 'बल्ला / बैट', 'general', 0.07, 0.84],
  'baseball glove': ['Glove', 'दस्ताना', 'accessory', 0.25, 0.28],
  skateboard: ['Skateboard', 'स्केटबोर्ड', 'general', 0.22, 0.78],
  surfboard: ['Surfboard', 'सर्फबोर्ड', 'general', 0.52, 1.85],
  'tennis racket': ['Racket', 'रैकेट', 'general', 0.28, 0.68],
  bottle: ['Bottle', 'बोतल', 'kitchen', 0.075, 0.23],
  'wine glass': ['Glass', 'ग्लास', 'kitchen', 0.08, 0.20],
  cup: ['Cup / Mug', 'कप / मग', 'kitchen', 0.085, 0.105],
  fork: ['Fork', 'कांटा', 'kitchen', 0.03, 0.19],
  knife: ['Knife', 'चाकू', 'kitchen', 0.03, 0.22],
  spoon: ['Spoon', 'चम्मच', 'kitchen', 0.04, 0.18],
  bowl: ['Bowl', 'कटोरा / बाउल', 'kitchen', 0.16, 0.08],
  banana: ['Banana', 'केला', 'kitchen', 0.18, 0.06],
  apple: ['Apple', 'सेब', 'kitchen', 0.08, 0.08],
  sandwich: ['Sandwich', 'सैंडविच', 'kitchen', 0.14, 0.08],
  orange: ['Orange', 'संतरा', 'kitchen', 0.08, 0.08],
  broccoli: ['Broccoli', 'ब्रोकली', 'kitchen', 0.14, 0.14],
  carrot: ['Carrot', 'गाजर', 'kitchen', 0.04, 0.18],
  'hot dog': ['Hot Dog', 'हॉट डॉग', 'kitchen', 0.16, 0.06],
  pizza: ['Pizza', 'पिज़्ज़ा', 'kitchen', 0.32, 0.12],
  donut: ['Donut', 'डोनट', 'kitchen', 0.10, 0.10],
  cake: ['Cake', 'केक', 'kitchen', 0.24, 0.14],
  chair: ['Chair', 'कुर्सी', 'furniture', 0.52, 0.86],
  couch: ['Sofa / Couch', 'सोफा', 'furniture', 1.85, 0.85],
  'potted plant': ['Plant / Pot', 'गमला / पौधा', 'general', 0.35, 0.55],
  bed: ['Bed', 'बिस्तर / बेड', 'furniture', 1.60, 0.75],
  'dining table': ['Table / Desk', 'मेज / टेबल', 'furniture', 1.20, 0.76],
  toilet: ['Toilet', 'टॉयलेट', 'furniture', 0.45, 0.76],
  tv: ['TV / Monitor', 'टीवी / मॉनिटर', 'electronics', 0.98, 0.58],
  laptop: ['Laptop', 'लैपटॉप', 'electronics', 0.35, 0.24],
  mouse: ['Computer Mouse', 'कंप्यूटर माउस', 'electronics', 0.065, 0.11],
  remote: ['Remote Control', 'रिमोट कंट्रोल', 'electronics', 0.05, 0.17],
  keyboard: ['Keyboard', 'कीबोर्ड', 'electronics', 0.43, 0.15],
  'cell phone': ['Mobile Phone', 'मोबाइल फोन', 'electronics', 0.075, 0.152],
  microwave: ['Microwave', 'माइक्रोवेव', 'electronics', 0.50, 0.30],
  oven: ['Oven', 'ओवन', 'electronics', 0.60, 0.75],
  toaster: ['Toaster', 'टोस्टर', 'electronics', 0.28, 0.20],
  sink: ['Sink', 'सिंक / वॉशबेसिन', 'furniture', 0.55, 0.32],
  refrigerator: ['Refrigerator', 'फ्रिज', 'electronics', 0.72, 1.72],
  book: ['Book / Notebook', 'किताब / कॉपी', 'accessory', 0.16, 0.23],
  clock: ['Clock / Watch', 'घड़ी', 'electronics', 0.28, 0.28],
  vase: ['Vase', 'फूलदान', 'accessory', 0.14, 0.28],
  scissors: ['Scissors', 'कैंची', 'accessory', 0.08, 0.20],
  'teddy bear': ['Teddy Bear / Toy', 'टेडी बियर / खिलौना', 'accessory', 0.28, 0.38],
  'hair drier': ['Hair Dryer', 'हेयर ड्रायर', 'electronics', 0.20, 0.22],
  toothbrush: ['Toothbrush', 'टूथब्रश', 'accessory', 0.025, 0.18],
};

export function mapCocoClass(rawClass: string): ClassMeta & { realWorldHeightMeters: number } {
  const c = rawClass.toLowerCase().trim();
  const entry = COCO_CLASS_META[c];
  if (entry) {
    return {
      displayName: entry[0],
      displayNameHi: entry[1],
      category: entry[2],
      realWidthMeters: entry[3],
      realHeightMeters: entry[4],
      realWorldHeightMeters: entry[4],
    };
  }
  const capitalized = c.charAt(0).toUpperCase() + c.slice(1);
  return {
    displayName: capitalized,
    displayNameHi: capitalized,
    category: 'general',
    realWidthMeters: 0.35,
    realHeightMeters: 0.35,
    realWorldHeightMeters: 0.35,
  };
}

// Accurate pinhole geometry distance estimator using orientation-matched physical dimensions
// and partial-crop detection for humans sitting/standing close to the camera.
export function estimateAccurateDistanceMeters(
  rawClass: string,
  bboxX: number,
  bboxY: number,
  bboxW: number,
  bboxH: number,
  frameW: number,
  frameH: number
): number {
  const meta = mapCocoClass(rawClass);
  const c = rawClass.toLowerCase().trim();

  // Standard camera focal length in pixels (~60° horizontal / longest-edge FOV)
  const focalPx = Math.max(frameW, frameH) * 0.88;
  const safeW = Math.max(12, bboxW);
  const safeH = Math.max(12, bboxH);

  let distMeters: number;

  if (c === 'person') {
    // Check whether person is cropped at bottom/top edge (e.g. seated at desk or closeup)
    const touchesBottom = bboxY + bboxH >= frameH * 0.92;
    const touchesTop = bboxY <= frameH * 0.06;
    const aspect = safeW / safeH; // wide aspect when only head/shoulders are in frame

    // Shoulder width (~0.46m) stays remarkably stable across sitting/standing poses
    const distByWidth = (0.46 * focalPx) / safeW;

    let effectiveHeight = 1.68;
    if (touchesBottom && touchesTop) {
      effectiveHeight = 0.55;
    } else if (touchesBottom && aspect > 0.65) {
      // Head + upper chest portrait
      effectiveHeight = 0.52;
    } else if (touchesBottom) {
      // Seated / waist-up
      effectiveHeight = 0.85;
    }

    const distByHeight = (effectiveHeight * focalPx) / safeH;
    // Favor width heavily for close/seated frames, blend evenly for full-body views
    distMeters = touchesBottom ? distByWidth * 0.65 + distByHeight * 0.35 : distByWidth * 0.4 + distByHeight * 0.6;
  } else {
    // Match major & minor bbox axes to object's real major & minor physical dimensions
    // so horizontal vs vertical rotation (e.g. tilted phone/bottle/book) stays accurate
    const realMajor = Math.max(meta.realWidthMeters, meta.realHeightMeters);
    const realMinor = Math.min(meta.realWidthMeters, meta.realHeightMeters);
    const pxMajor = Math.max(safeW, safeH);
    const pxMinor = Math.min(safeW, safeH);

    const distMajor = (realMajor * focalPx) / pxMajor;
    const distArea = (Math.sqrt(realMajor * realMinor) * focalPx) / Math.sqrt(pxMajor * pxMinor);
    distMeters = distMajor * 0.6 + distArea * 0.4;
  }

  const clamped = Math.max(0.15, Math.min(25.0, distMeters));
  return clamped < 1.0 ? Number(clamped.toFixed(2)) : Number(clamped.toFixed(1));
}

export type CocoBaseModel = 'lite_mobilenet_v2' | 'mobilenet_v2';

class CocoSsdManager {
  private model: any = null;
  // Default to full HD MobileNet V2 for much higher recall on everyday & smaller objects
  private currentBase: CocoBaseModel = 'mobilenet_v2';
  private isLoading = false;
  private isDetecting = false;
  private loadPromise: Promise<any> | null = null;
  private backendInitialized = false;
  private backendName = 'webgl';
  private lastError: string | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;

  private async ensureBackendsReady(): Promise<void> {
    if (this.backendInitialized) return;
    try {
      try {
        await tf.setBackend('cpu');
        await tf.ready();
      } catch {}

      try {
        await tf.setBackend('webgl');
        await tf.ready();
        this.backendName = tf.getBackend() || 'webgl';
      } catch (webglErr) {
        console.warn('[COCO-SSD] WebGL backend unavailable, falling back to CPU:', webglErr);
        await tf.setBackend('cpu');
        await tf.ready();
        this.backendName = tf.getBackend() || 'cpu';
      }

      this.backendInitialized = true;
    } catch (err) {
      console.warn('[COCO-SSD] tf.ready warning:', err);
      this.backendName = tf.getBackend() || 'cpu';
    }
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

  public async initialize(base: CocoBaseModel = this.currentBase, forceReload = false): Promise<any> {
    if (this.model && !forceReload && base === this.currentBase) {
      return this.model;
    }
    if (this.loadPromise && !forceReload && base === this.currentBase) {
      return this.loadPromise;
    }

    if (forceReload) {
      if (this.model) {
        try {
          this.model.dispose?.();
        } catch {}
        this.model = null;
      }
      this.loadPromise = null;
    }

    this.currentBase = base;
    this.isLoading = true;
    this.lastError = null;

    this.loadPromise = (async () => {
      try {
        await this.withTimeout(this.ensureBackendsReady(), 6000, 'TF.js backend');

        const loadWithBase = async (targetBase: CocoBaseModel) => {
          const modelDir =
            targetBase === 'lite_mobilenet_v2' ? 'ssdlite_mobilenet_v2' : 'ssd_mobilenet_v2';
          const proxyUrl = `${window.location.origin}/api/models/coco-ssd/${modelDir}/model.json`;
          try {
            console.log(`[COCO-SSD] Loading ${targetBase} via local proxy on ${this.backendName}...`);
            return await this.withTimeout(
              cocoSsd.load({ base: targetBase, modelUrl: proxyUrl }),
              18000,
              `COCO-SSD proxy (${targetBase})`
            );
          } catch (proxyErr: any) {
            console.warn(
              `[COCO-SSD] Local proxy load failed/timed out for ${targetBase}, trying direct CDN:`,
              proxyErr?.message || proxyErr
            );
            return await this.withTimeout(
              cocoSsd.load({ base: targetBase }),
              18000,
              `COCO-SSD direct (${targetBase})`
            );
          }
        };

        let loaded: any = null;
        try {
          loaded = await loadWithBase(base);
        } catch (primaryErr) {
          if (base !== 'lite_mobilenet_v2') {
            console.warn('[COCO-SSD] Full mobilenet_v2 timed out/failed, falling back to fast lite_mobilenet_v2');
            this.currentBase = 'lite_mobilenet_v2';
            loaded = await loadWithBase('lite_mobilenet_v2');
          } else {
            throw primaryErr;
          }
        }

        this.model = loaded;
        this.isLoading = false;
        this.lastError = null;
        console.log(`[COCO-SSD] ${this.currentBase} loaded successfully on ${this.backendName}.`);
        return loaded;
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to load COCO-SSD vision weights.';
        console.error('[COCO-SSD] Failed to load model:', err);
        this.lastError = errMsg;
        this.isLoading = false;
        this.loadPromise = null;
        return null;
      }
    })();

    return this.loadPromise;
  }

  public async retryInitialize(): Promise<any> {
    return this.initialize(this.currentBase, true);
  }

  public getCurrentBase(): CocoBaseModel {
    return this.currentBase;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public isModelReady(): boolean {
    return Boolean(this.model);
  }

  public isModelLoading(): boolean {
    return this.isLoading;
  }

  public getBackendName(): string {
    return this.backendName;
  }

  private prepareScaledInput(
    mediaSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): {
    inputElement: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;
    origWidth: number;
    origHeight: number;
    scaleX: number;
    scaleY: number;
    isBlankFrame: boolean;
  } {
    let origWidth = 640;
    let origHeight = 480;

    if (mediaSource instanceof HTMLVideoElement) {
      origWidth = mediaSource.videoWidth || 640;
      origHeight = mediaSource.videoHeight || 480;
    } else if (mediaSource instanceof HTMLImageElement) {
      origWidth = mediaSource.naturalWidth || mediaSource.width || 640;
      origHeight = mediaSource.naturalHeight || mediaSource.height || 480;
    } else if (mediaSource instanceof HTMLCanvasElement) {
      origWidth = mediaSource.width || 640;
      origHeight = mediaSource.height || 480;
    }

    // 640px max dimension preserves small desktop/handheld objects clearly while staying fast on WebGL
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(origWidth, origHeight));
    const targetW = Math.max(64, Math.round(origWidth * scale));
    const targetH = Math.max(64, Math.round(origHeight * scale));

    if (typeof document !== 'undefined') {
      if (!this.captureCanvas) {
        this.captureCanvas = document.createElement('canvas');
      }
      if (this.captureCanvas.width !== targetW || this.captureCanvas.height !== targetH) {
        this.captureCanvas.width = targetW;
        this.captureCanvas.height = targetH;
      }
      const ctx = this.captureCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(mediaSource, 0, 0, targetW, targetH);

        let isBlankFrame = false;
        if (mediaSource instanceof HTMLVideoElement) {
          try {
            const sample = ctx.getImageData(
              Math.floor(targetW * 0.25),
              Math.floor(targetH * 0.25),
              Math.min(16, targetW),
              Math.min(16, targetH)
            ).data;
            let sum = 0;
            for (let i = 0; i < sample.length; i += 4) {
              sum += sample[i] + sample[i + 1] + sample[i + 2];
            }
            isBlankFrame = sum === 0;
          } catch {
            isBlankFrame = false;
          }
        }

        return {
          inputElement: this.captureCanvas,
          origWidth,
          origHeight,
          scaleX: origWidth / targetW,
          scaleY: origHeight / targetH,
          isBlankFrame,
        };
      }
    }

    return {
      inputElement: mediaSource,
      origWidth,
      origHeight,
      scaleX: 1,
      scaleY: 1,
      isBlankFrame: false,
    };
  }

  private computeIoU(a: [number, number, number, number], b: [number, number, number, number]): number {
    const [ay1, ax1, ay2, ax2] = a;
    const [by1, bx1, by2, bx2] = b;
    const interY1 = Math.max(ay1, by1);
    const interX1 = Math.max(ax1, bx1);
    const interY2 = Math.min(ay2, by2);
    const interX2 = Math.min(ax2, bx2);
    const interArea = Math.max(0, interY2 - interY1) * Math.max(0, interX2 - interX1);
    if (interArea <= 0) return 0;
    const areaA = Math.max(0, ay2 - ay1) * Math.max(0, ax2 - ax1);
    const areaB = Math.max(0, by2 - by1) * Math.max(0, bx2 - bx1);
    return interArea / Math.max(1e-6, areaA + areaB - interArea);
  }

  private async runModelPredict(
    inputElement: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    maxNumBoxes: number,
    confidenceThreshold: number
  ): Promise<Array<{ bbox: [number, number, number, number]; class: string; score: number }>> {
    // Use per-class Non-Maximum Suppression so overlapping DIFFERENT objects
    // (e.g. cup/phone/laptop/keyboard/mouse on top of a dining table, or person holding a phone)
    // do NOT suppress each other!
    if (
      this.model?.model &&
      typeof this.model.calculateMaxScores === 'function' &&
      typeof this.model.buildDetectedObjects === 'function'
    ) {
      const batched = tf.tidy(() => {
        const pixels = tf.browser.fromPixels(inputElement);
        return tf.expandDims(pixels);
      });

      const height = batched.shape[1]!;
      const width = batched.shape[2]!;

      let result: tf.Tensor[] = [];
      try {
        result = (await this.model.model.executeAsync(batched)) as tf.Tensor[];
        const scores = (await result[0].data()) as Float32Array;
        const boxes = (await result[1].data()) as Float32Array;
        const numBoxes = result[0].shape[1]!;
        const numClasses = result[0].shape[2]!;

        const [maxScores, classes] = this.model.calculateMaxScores(scores, numBoxes, numClasses);

        // Gather candidates above threshold in a single fast pass
        const candidates: Array<{ idx: number; score: number; cls: number; box: [number, number, number, number] }> = [];
        for (let i = 0; i < numBoxes; i++) {
          const score = maxScores[i];
          if (score >= confidenceThreshold) {
            const offset = i * 4;
            candidates.push({
              idx: i,
              score,
              cls: classes[i],
              box: [boxes[offset], boxes[offset + 1], boxes[offset + 2], boxes[offset + 3]],
            });
          }
        }

        // Sort descending by confidence
        candidates.sort((a, b) => b.score - a.score);

        // Per-class NMS (IoU 0.45 within same class, allows distinct overlapping classes)
        const selected: typeof candidates = [];
        for (const cand of candidates) {
          let suppressed = false;
          for (const kept of selected) {
            if (kept.cls === cand.cls && this.computeIoU(kept.box, cand.box) > 0.45) {
              suppressed = true;
              break;
            }
          }
          if (!suppressed) {
            selected.push(cand);
            if (selected.length >= maxNumBoxes) break;
          }
        }

        const selectedIndexes = Int32Array.from(selected.map((s) => s.idx));
        return this.model.buildDetectedObjects(width, height, boxes, maxScores, selectedIndexes, classes);
      } finally {
        batched.dispose();
        tf.dispose(result);
      }
    }

    return await this.model.detect(inputElement, maxNumBoxes, confidenceThreshold);
  }

  public async detectIfIdle(
    mediaSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    confidenceThreshold = 0.18
  ): Promise<CocoDetection[] | null> {
    if (this.isDetecting) {
      return null;
    }
    return this.detect(mediaSource, confidenceThreshold);
  }

  public async detect(
    mediaSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    confidenceThreshold = 0.18
  ): Promise<CocoDetection[]> {
    if (!this.model) {
      await this.initialize();
    }
    if (!this.model) return [];

    if (mediaSource instanceof HTMLVideoElement) {
      if (!mediaSource.videoWidth || !mediaSource.videoHeight || mediaSource.readyState < 2) {
        return [];
      }
    } else if (mediaSource instanceof HTMLImageElement) {
      if (!mediaSource.naturalWidth || !mediaSource.naturalHeight) {
        return [];
      }
    } else if (mediaSource instanceof HTMLCanvasElement) {
      if (!mediaSource.width || !mediaSource.height) {
        return [];
      }
    }

    if (this.isDetecting) {
      return [];
    }
    this.isDetecting = true;

    try {
      const { inputElement, origWidth, origHeight, scaleX, scaleY, isBlankFrame } = this.prepareScaledInput(mediaSource);
      if (isBlankFrame) {
        return [];
      }

      const predictions = await this.runModelPredict(inputElement, 35, confidenceThreshold);

      return predictions.map((pred: any, index: number) => {
        const [rawX, rawY, rawW, rawH] = pred.bbox;
        const x = rawX * scaleX;
        const y = rawY * scaleY;
        const width = rawW * scaleX;
        const height = rawH * scaleY;
        const meta = mapCocoClass(pred.class);

        const estimatedDistanceMeters = estimateAccurateDistanceMeters(
          pred.class,
          x,
          y,
          width,
          height,
          origWidth,
          origHeight
        );

        return {
          id: `real-${pred.class}-${index}`,
          class: pred.class,
          displayName: meta.displayName,
          displayNameHi: meta.displayNameHi,
          category: meta.category,
          confidence: Number(pred.score.toFixed(2)),
          bbox: [Math.round(x), Math.round(y), Math.round(width), Math.round(height)] as [number, number, number, number],
          estimatedDistanceMeters,
          color: CATEGORY_COLORS[meta.category].border,
          source: 'coco',
        };
      });
    } catch (err) {
      console.warn('[COCO-SSD] Detection frame error:', err);
      return [];
    } finally {
      this.isDetecting = false;
    }
  }

  public toRecognizedObjects(detections: CocoDetection[]): RecognizedObject[] {
    return detections.map((d) => ({
      id: d.id,
      label: d.displayName,
      confidence: d.confidence,
      box: {
        x: d.bbox[0],
        y: d.bbox[1],
        width: d.bbox[2],
        height: d.bbox[3],
      },
      estimatedDistanceMeters: d.estimatedDistanceMeters,
    }));
  }
}

export const cocoSsdService = new CocoSsdManager();
