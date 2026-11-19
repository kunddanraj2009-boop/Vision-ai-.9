import { FilesetResolver, GestureRecognizer, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type GestureType =
  | 'peace'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'open_palm'
  | 'fist'
  | 'pointing'
  | 'i_love_you'
  | 'ok_sign'
  | 'call_me'
  | 'rock_on'
  | 'three'
  | 'four';

export interface GestureMeaningMeta {
  id: GestureType;
  emoji: string;
  labelEn: string;
  labelHi: string;
  meaningEn: string;
  meaningHi: string;
  spokenEn: string;
  spokenHi: string;
}

export const GESTURE_SIGN_INFO: Record<GestureType, GestureMeaningMeta> = {
  peace: {
    id: 'peace',
    emoji: '✌️',
    labelEn: 'Peace / Victory',
    labelHi: 'पीस / विक्ट्री',
    meaningEn: 'Peace, Victory, Two, or Hello',
    meaningHi: 'शांति, जीत, दो या नमस्ते',
    spokenEn: 'Peace sign. It means peace, victory, or hello.',
    spokenHi: 'पीस साइन। इसका मतलब है शांति, जीत या नमस्ते।',
  },
  thumbs_up: {
    id: 'thumbs_up',
    emoji: '👍',
    labelEn: 'Thumbs Up',
    labelHi: 'थम्स अप',
    meaningEn: 'Yes, Good, Okay, or Approved',
    meaningHi: 'हाँ, बहुत अच्छा या मंज़ूरी',
    spokenEn: 'Thumbs up. It means yes, good, or approved.',
    spokenHi: 'थम्स अप। इसका मतलब है हाँ, अच्छा या मंज़ूरी।',
  },
  thumbs_down: {
    id: 'thumbs_down',
    emoji: '👎',
    labelEn: 'Thumbs Down',
    labelHi: 'थम्स डाउन',
    meaningEn: 'No, Dislike, or Disapproved',
    meaningHi: 'नहीं, नापसंद या अस्वीकृत',
    spokenEn: 'Thumbs down. It means no, dislike, or disapproved.',
    spokenHi: 'थम्स डाउन। इसका मतलब है नहीं, नापसंद या अस्वीकृत।',
  },
  open_palm: {
    id: 'open_palm',
    emoji: '✋',
    labelEn: 'Open Palm / Five',
    labelHi: 'खुली हथेली / पांच',
    meaningEn: 'Stop, Wait, Hello, or Number Five',
    meaningHi: 'रुको, ठहरो, नमस्ते या पांच',
    spokenEn: 'Open palm. It means stop, wait, or hello.',
    spokenHi: 'खुली हथेली। इसका मतलब है रुको, ठहरो या नमस्ते।',
  },
  fist: {
    id: 'fist',
    emoji: '✊',
    labelEn: 'Closed Fist',
    labelHi: 'बंद मुट्ठी',
    meaningEn: 'Strength, Power, Hold, or Zero',
    meaningHi: 'ताकत, एकता, रोकना या शून्य',
    spokenEn: 'Closed fist. It means strength, power, or hold.',
    spokenHi: 'बंद मुट्ठी। इसका मतलब है ताकत, एकता या रोकना।',
  },
  pointing: {
    id: 'pointing',
    emoji: '☝️',
    labelEn: 'Pointing Up / One',
    labelHi: 'ऊपर इशारा / एक',
    meaningEn: 'Number One, Attention, or Look Up',
    meaningHi: 'एक, ध्यान दें या ऊपर देखें',
    spokenEn: 'Pointing up. It means number one or pay attention.',
    spokenHi: 'ऊपर इशारा। इसका मतलब है नंबर एक या ध्यान दें।',
  },
  i_love_you: {
    id: 'i_love_you',
    emoji: '🤟',
    labelEn: 'I Love You (ASL)',
    labelHi: 'आई लव यू साइन',
    meaningEn: 'I Love You, Care, and Affection',
    meaningHi: 'प्यार, स्नेह और अपनापन',
    spokenEn: 'I love you sign. It means love and affection.',
    spokenHi: 'आई लव यू साइन। इसका मतलब है प्यार और स्नेह।',
  },
  ok_sign: {
    id: 'ok_sign',
    emoji: '👌',
    labelEn: 'OK Sign',
    labelHi: 'ओके साइन',
    meaningEn: 'Okay, Perfect, Fine, or Agreed',
    meaningHi: 'बिल्कुल ठीक, बढ़िया या सहमत',
    spokenEn: 'O K sign. It means okay, perfect, or agreed.',
    spokenHi: 'ओके साइन। इसका मतलब है बिल्कुल ठीक या बढ़िया।',
  },
  call_me: {
    id: 'call_me',
    emoji: '🤙',
    labelEn: 'Call Me / Shaka',
    labelHi: 'कॉल मी / शाका',
    meaningEn: 'Call Me, Phone, or Chill / Friendly',
    meaningHi: 'कॉल करना, फोन या दोस्ताना इशारा',
    spokenEn: 'Call me sign. It means call me or friendly greeting.',
    spokenHi: 'कॉल मी साइन। इसका मतलब है मुझे कॉल करें या दोस्ताना अभिवादन।',
  },
  rock_on: {
    id: 'rock_on',
    emoji: '🤘',
    labelEn: 'Rock On',
    labelHi: 'रॉक ऑन साइन',
    meaningEn: 'Awesome, High Energy, or Celebration',
    meaningHi: 'शानदार, जोश या जश्न',
    spokenEn: 'Rock on sign. It means awesome or celebration.',
    spokenHi: 'रॉक ऑन साइन। इसका मतलब है शानदार या जश्न।',
  },
  three: {
    id: 'three',
    emoji: '3️⃣',
    labelEn: 'Three Fingers',
    labelHi: 'तीन उंगलियाँ',
    meaningEn: 'Number Three / Count Three',
    meaningHi: 'संख्या तीन',
    spokenEn: 'Three fingers. It means number three.',
    spokenHi: 'तीन उंगलियाँ। इसका मतलब है संख्या तीन।',
  },
  four: {
    id: 'four',
    emoji: '🖐️',
    labelEn: 'Four Fingers',
    labelHi: 'चार उंगलियाँ',
    meaningEn: 'Number Four / Count Four',
    meaningHi: 'संख्या चार',
    spokenEn: 'Four fingers. It means number four.',
    spokenHi: 'चार उंगलियाँ। इसका मतलब है संख्या चार।',
  },
};

export interface DetectedHandResult {
  landmarks: NormalizedLandmark[];
  handedness: 'Left' | 'Right';
  gesture: GestureType | null;
  rawGestureName: string;
  confidence: number;
}

export const HAND_CONNECTIONS: Array<[number, number]> = [
  // Wrist to finger bases
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  // Palm knuckles
  [5, 9], [9, 13], [13, 17],
];

class GestureRecognitionManager {
  private recognizer: GestureRecognizer | null = null;
  private isLoading = false;
  private loadPromise: Promise<GestureRecognizer | null> | null = null;
  private lastError: string | null = null;
  private delegateName: 'GPU' | 'CPU' = 'GPU';
  private lastTimestamp = 0;
  private captureCanvas: HTMLCanvasElement | null = null;

  public isReady(): boolean {
    return Boolean(this.recognizer);
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
        throw new Error(`HTTP ${res.status} fetching model`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } finally {
      clearTimeout(timer);
    }
  }

  public async initialize(forceReload = false): Promise<GestureRecognizer | null> {
    if (this.recognizer && !forceReload) return this.recognizer;
    if (this.loadPromise && !forceReload) return this.loadPromise;

    if (forceReload) {
      if (this.recognizer) {
        try {
          this.recognizer.close();
        } catch {}
        this.recognizer = null;
      }
      this.loadPromise = null;
    }

    this.isLoading = true;
    this.lastError = null;

    this.loadPromise = (async () => {
      try {
        let visionWasm;
        try {
          visionWasm = await this.withTimeout(
            FilesetResolver.forVisionTasks('/mediapipe-wasm'),
            6000,
            'WASM resolver'
          );
        } catch {
          visionWasm = await this.withTimeout(
            FilesetResolver.forVisionTasks(
              'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
            ),
            8000,
            'CDN WASM resolver'
          );
        }

        const localModelUrl = `${window.location.origin}/api/models/mediapipe/gesture_recognizer.task`;
        const remoteModelUrl =
          'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

        let modelBytes: Uint8Array | null = null;
        try {
          modelBytes = await this.fetchModelBuffer(localModelUrl, 12000);
        } catch {
          try {
            modelBytes = await this.fetchModelBuffer(remoteModelUrl, 12000);
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
            GestureRecognizer.createFromOptions(visionWasm, {
              baseOptions,
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.4,
              minHandPresenceConfidence: 0.4,
              minTrackingConfidence: 0.4,
            }),
            delegate === 'GPU' ? 4500 : 9000,
            `GestureRecognizer(${delegate})`
          );
        };

        let instance: GestureRecognizer | null = null;
        try {
          instance = await createWithOptions('GPU');
          this.delegateName = 'GPU';
        } catch (gpuErr) {
          console.warn('[GestureAI] GPU init failed/timed out, using CPU delegate:', gpuErr);
          try {
            instance = await createWithOptions('CPU');
            this.delegateName = 'CPU';
          } catch (cpuLocalErr) {
            console.warn('[GestureAI] Retrying CPU with remote model path:', cpuLocalErr);
            instance = await createWithOptions('CPU', true);
            this.delegateName = 'CPU';
          }
        }

        this.recognizer = instance;
        this.isLoading = false;
        this.lastError = null;
        console.log(`[GestureAI] MediaPipe GestureRecognizer ready (${this.delegateName}).`);
        return instance;
      } catch (err: any) {
        const msg = err?.message || 'Failed to initialize MediaPipe Gesture Recognizer.';
        console.error('[GestureAI] Initialization error:', err);
        this.lastError = msg;
        this.isLoading = false;
        this.loadPromise = null;
        return null;
      }
    })();

    return this.loadPromise;
  }

  private mapMediaPipeCategory(name: string): GestureType | null {
    switch (name) {
      case 'Victory':
        return 'peace';
      case 'Thumb_Up':
        return 'thumbs_up';
      case 'Thumb_Down':
        return 'thumbs_down';
      case 'Open_Palm':
        return 'open_palm';
      case 'Closed_Fist':
        return 'fist';
      case 'Pointing_Up':
        return 'pointing';
      case 'ILoveYou':
        return 'i_love_you';
      default:
        return null;
    }
  }

  // Geometric 21-landmark classifier for extra universal signs (OK, Call Me, Rock On, 3, 4, Thumbs Down) & fallback
  private classifyFromLandmarks(lm: NormalizedLandmark[]): { gesture: GestureType | null; confidence: number } {
    if (!lm || lm.length < 21) return { gesture: null, confidence: 0 };

    const dist = (a: NormalizedLandmark, b: NormalizedLandmark) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const wrist = lm[0];
    const indexMcp = lm[5];
    const pinkyMcp = lm[17];
    const palmSize = Math.max(0.04, dist(wrist, lm[9]));

    // Finger extended check using wrist-to-tip vs wrist-to-PIP distance
    const indexUp = dist(wrist, lm[8]) > dist(wrist, lm[6]) * 1.14;
    const middleUp = dist(wrist, lm[12]) > dist(wrist, lm[10]) * 1.14;
    const ringUp = dist(wrist, lm[16]) > dist(wrist, lm[14]) * 1.14;
    const pinkyUp = dist(wrist, lm[20]) > dist(wrist, lm[18]) * 1.14;

    const thumbExtended =
      dist(lm[4], pinkyMcp) > dist(lm[3], pinkyMcp) * 1.1 &&
      dist(lm[4], indexMcp) > palmSize * 0.48;
    const thumbPointingUp =
      lm[4].y < lm[3].y && lm[3].y < lm[2].y && lm[4].y < wrist.y - palmSize * 0.35;
    const thumbPointingDown =
      lm[4].y > lm[3].y && lm[3].y > lm[2].y && lm[4].y > wrist.y + palmSize * 0.25;

    // 1. OK Sign: thumb tip & index tip touching/pinched, middle + ring + pinky extended
    const thumbIndexPinchDist = dist(lm[4], lm[8]);
    if (thumbIndexPinchDist < palmSize * 0.42 && middleUp && ringUp && pinkyUp) {
      return { gesture: 'ok_sign', confidence: 0.91 };
    }

    // 2. Open Palm vs Four Fingers
    if (indexUp && middleUp && ringUp && pinkyUp) {
      if (thumbExtended) {
        return { gesture: 'open_palm', confidence: 0.91 };
      }
      return { gesture: 'four', confidence: 0.88 };
    }

    // 3. Number Three (Index + Middle + Ring up)
    if (indexUp && middleUp && ringUp && !pinkyUp) {
      return { gesture: 'three', confidence: 0.88 };
    }

    // 4. Peace / Victory (Index + Middle up)
    if (indexUp && middleUp && !ringUp && !pinkyUp) {
      return { gesture: 'peace', confidence: 0.9 };
    }

    // 5. I Love You (Thumb + Index + Pinky up) vs Rock On (Index + Pinky up)
    if (indexUp && !middleUp && !ringUp && pinkyUp) {
      if (thumbExtended) {
        return { gesture: 'i_love_you', confidence: 0.9 };
      }
      return { gesture: 'rock_on', confidence: 0.89 };
    }

    // 6. Call Me / Shaka (Thumb + Pinky up)
    if (!indexUp && !middleUp && !ringUp && pinkyUp && thumbExtended) {
      return { gesture: 'call_me', confidence: 0.89 };
    }

    // 7. Pointing Up (Only Index up)
    if (indexUp && !middleUp && !ringUp && !pinkyUp) {
      return { gesture: 'pointing', confidence: 0.89 };
    }

    // 8. Thumbs Up / Thumbs Down / Closed Fist
    if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
      if (thumbPointingDown) {
        return { gesture: 'thumbs_down', confidence: 0.88 };
      }
      if (thumbPointingUp || thumbExtended) {
        return { gesture: 'thumbs_up', confidence: 0.88 };
      }
      return { gesture: 'fist', confidence: 0.87 };
    }

    return { gesture: null, confidence: 0 };
  }

  public detectVideoFrame(video: HTMLVideoElement): DetectedHandResult[] {
    if (!this.recognizer || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
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

      const res = this.recognizer.recognizeForVideo(sourceInput, this.lastTimestamp);
      if (!res || !res.landmarks || res.landmarks.length === 0) {
        return [];
      }

      return res.landmarks.map((landmarks, idx) => {
        const topGesture = res.gestures?.[idx]?.[0];
        const rawName = topGesture?.categoryName || 'None';
        const rawScore = topGesture?.score ?? 0;

        let mapped = this.mapMediaPipeCategory(rawName);
        let confidence = rawScore;

        // Check geometric classifier for signs MediaPipe doesn't have (OK, Call Me, Rock On, Three, Four)
        // or when MediaPipe returns None / low confidence
        const geo = this.classifyFromLandmarks(landmarks);
        if (!mapped || confidence < 0.5) {
          if (geo.gesture) {
            mapped = geo.gesture;
            confidence = geo.confidence;
          }
        } else if (
          (mapped === 'open_palm' || mapped === 'pointing' || mapped === 'fist') &&
          geo.gesture &&
          ['ok_sign', 'call_me', 'rock_on'].includes(geo.gesture)
        ) {
          mapped = geo.gesture;
          confidence = geo.confidence;
        }

        const handednessLabel = res.handedness?.[idx]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';

        return {
          landmarks,
          handedness: handednessLabel,
          gesture: mapped,
          rawGestureName: rawName,
          confidence: Number(confidence.toFixed(2)),
        };
      });
    } catch (err) {
      console.warn('[GestureAI] Frame recognition error:', err);
      return [];
    }
  }
}

export const gestureService = new GestureRecognitionManager();
