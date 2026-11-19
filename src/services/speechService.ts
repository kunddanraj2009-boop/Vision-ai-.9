import { LanguageCode } from '../types/nancy';
import { playAudioFx } from './audioSynth';

export type SpeechState = 'idle' | 'listening' | 'speaking';

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isWakeMode: boolean = false;
  private language: LanguageCode = 'en';
  private voiceVolume: number = 1;
  private voicePitch: number = 1.05;
  private voiceRate: number = 1.0;
  private selectedVoiceIndex: number = 0;
  private isCurrentlySpeaking: boolean = false;
  private lastSpokenTime: number = 0;

  private onTranscriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onWakeCallback: (() => void) | null = null;
  private onStateChangeCallback: ((state: SpeechState) => void) | null = null;
  private onCommandCallback: ((commandText: string) => void) | null = null;

  constructor() {
    this.initRecognition();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Reload voices when ready
      };
    }
  }

  private speechDebounceTimer: any = null;

  private initRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('Speech Recognition not supported in this browser environment.');
      return;
    }

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language === 'hi' ? 'hi-IN' : 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStateChangeCallback?.('listening');
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        // Guard against acoustic echo loop: ignore transcripts while assistant is speaking or right after
        if (this.isCurrentlySpeaking || (Date.now() - this.lastSpokenTime < 900)) {
          return;
        }

        const currentText = (finalTranscript || interimTranscript).trim();

        if (currentText) {
          this.onTranscriptCallback?.(currentText, Boolean(finalTranscript));

          // Check for wake word if in wake mode
          const lower = currentText.toLowerCase();
          if (
            this.isWakeMode &&
            (lower.includes('hey vision') ||
              lower.includes('vision') ||
              lower.includes('use vision') ||
              lower.includes('विज़न'))
          ) {
            playAudioFx.wakeChime();
            this.onWakeCallback?.();
          }

          if (finalTranscript) {
            if (this.speechDebounceTimer) clearTimeout(this.speechDebounceTimer);
            this.onCommandCallback?.(finalTranscript.trim());
          } else {
            // Auto-finalize interim transcript after 1.3s of silence so user isn't stuck waiting
            if (this.speechDebounceTimer) clearTimeout(this.speechDebounceTimer);
            this.speechDebounceTimer = setTimeout(() => {
              if (currentText && !this.isCurrentlySpeaking) {
                this.onTranscriptCallback?.(currentText, true);
                this.onCommandCallback?.(currentText);
              }
            }, 1300);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // If aborted or no-speech, recover gracefully
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition error:', event.error);
        }
        if (event.error === 'not-allowed') {
          this.stopListening();
        }
      };

      this.recognition.onend = () => {
        if (this.speechDebounceTimer) clearTimeout(this.speechDebounceTimer);
        this.isListening = false;
        // If wake mode is active, restart continuous listener automatically
        if (this.isWakeMode) {
          try {
            this.recognition.start();
          } catch {
            this.onStateChangeCallback?.('idle');
          }
        } else {
          this.onStateChangeCallback?.('idle');
        }
      };
    } catch (e) {
      console.error('Failed to init SpeechRecognition', e);
    }
  }

  public setLanguage(lang: LanguageCode) {
    this.language = lang;
    if (this.recognition) {
      const wasListening = this.isListening;
      if (wasListening) this.stopListening();
      this.recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
      if (wasListening) this.startListening();
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  public setVoiceSettings(volume: number, pitch: number, rate: number, voiceIndex: number) {
    this.voiceVolume = volume;
    this.voicePitch = pitch;
    this.voiceRate = rate;
    this.selectedVoiceIndex = voiceIndex;
  }

  public isSpeechRecognitionAvailable(): boolean {
    return Boolean(
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public isWakeModeActive(): boolean {
    return this.isWakeMode;
  }

  public setWakeMode(active: boolean) {
    this.isWakeMode = active;
    if (active && !this.isListening) {
      this.startListening();
    } else if (!active && this.isListening) {
      this.stopListening();
    }
  }

  public startListening(): boolean {
    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) return false;
    }
    try {
      this.recognition.start();
      playAudioFx.click();
      return true;
    } catch (e) {
      console.warn('Error starting speech recognition:', e);
      return false;
    }
  }

  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
    this.onStateChangeCallback?.('idle');
  }

  public toggleListening(): boolean {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      return this.startListening();
    }
  }

  public speak(text: string, onEnd?: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.();
        resolve();
        return;
      }

      // Cancel previous utterance
      window.speechSynthesis.cancel();

      // Clean speech text (strip markdown symbols like ** and #)
      const cleanText = text
        .replace(/[*#`_~]/g, '')
        .replace(/https?:\/\/\S+/g, 'link')
        .replace(/\[.*?\]/g, '')
        .trim();

      if (!cleanText) {
        onEnd?.();
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.volume = this.voiceVolume;
      utterance.pitch = this.voicePitch;
      utterance.rate = this.voiceRate;

      const voices = this.getAvailableVoices();
      if (voices.length > 0) {
        if (this.selectedVoiceIndex >= 0 && voices[this.selectedVoiceIndex]) {
          utterance.voice = voices[this.selectedVoiceIndex];
        } else {
          // Prefer voice matching chosen language
          const prefix = this.language === 'hi' ? 'hi' : 'en';
          const match = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
          if (match) utterance.voice = match;
        }
      }

      this.isCurrentlySpeaking = true;
      this.onStateChangeCallback?.('speaking');

      utterance.onend = () => {
        this.isCurrentlySpeaking = false;
        this.lastSpokenTime = Date.now();
        this.onStateChangeCallback?.('idle');
        onEnd?.();
        resolve();
      };

      utterance.onerror = (e) => {
        this.isCurrentlySpeaking = false;
        this.lastSpokenTime = Date.now();
        console.warn('Speech synthesis error:', e);
        this.onStateChangeCallback?.('idle');
        onEnd?.();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  public stopSpeaking() {
    this.isCurrentlySpeaking = false;
    this.lastSpokenTime = Date.now();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.onStateChangeCallback?.('idle');
    }
  }

  public onTranscript(cb: (transcript: string, isFinal: boolean) => void) {
    this.onTranscriptCallback = cb;
  }

  public onWake(cb: () => void) {
    this.onWakeCallback = cb;
  }

  public onStateChange(cb: (state: SpeechState) => void) {
    this.onStateChangeCallback = cb;
  }

  public onCommand(cb: (commandText: string) => void) {
    this.onCommandCallback = cb;
  }
}

export const speechService = new SpeechService();
