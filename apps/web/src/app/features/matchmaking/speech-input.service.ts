import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  NgZone,
  signal,
} from '@angular/core';

export interface SpeechResultEvent {
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
}
export interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognizer;
    webkitSpeechRecognition?: new () => SpeechRecognizer;
  }
}
export const SPEECH_RECOGNIZER = new InjectionToken<
  (() => SpeechRecognizer) | null
>('speech recognizer', {
  providedIn: 'root',
  factory: () => {
    if (typeof window === 'undefined' || !window.isSecureContext) return null;
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    return Recognition ? () => new Recognition() : null;
  },
});

@Injectable()
export class SpeechInputService {
  private readonly create = inject(SPEECH_RECOGNIZER);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  readonly supported = this.create !== null;
  readonly active = signal(false);
  readonly stopping = signal(false);
  readonly status = signal('');
  readonly error = signal<string | null>(null);
  readonly interim = signal('');
  private recognition: SpeechRecognizer | null = null;
  private finishRecognition: ((abort: boolean) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const hide = (): void => {
      if (this.document.hidden) this.cancel();
    };
    this.document.addEventListener('visibilitychange', hide);
    inject(DestroyRef).onDestroy(() => {
      this.cancel();
      this.document.removeEventListener('visibilitychange', hide);
    });
  }

  start(append: (text: string) => boolean): void {
    if (this.active()) return;
    this.error.set(null);
    if (!this.create) {
      this.error.set('voice.unsupported');
      return;
    }
    const committed = new Set<number>();
    try {
      const recognition = this.create();
      this.recognition = recognition;
      recognition.lang = 'pl-PL';
      recognition.continuous = true;
      recognition.interimResults = true;
      this.active.set(true);
      this.status.set('voice.starting');
      const current = (): boolean => this.recognition === recognition;
      recognition.onstart = () =>
        this.zone.run(() => {
          if (current() && !this.stopping()) this.status.set('voice.listening');
        });
      recognition.onresult = (event) =>
        this.zone.run(() => {
          if (!current()) return;
          const interim: string[] = [];
          for (let index = 0; index < event.results.length; index++) {
            const result = event.results[index];
            const text = result?.[0]?.transcript.trim();
            if (!text) continue;
            if (!result.isFinal) {
              interim.push(text);
              continue;
            }
            if (committed.has(index)) continue;
            committed.add(index);
            if (!append(text)) {
              this.cancel();
              this.error.set('voice.limit');
              return;
            }
          }
          this.interim.set(interim.join(' '));
        });
      recognition.onerror = (event) =>
        this.zone.run(() => {
          if (!current()) return;
          const key = ['not-allowed', 'service-not-allowed'].includes(
            event.error,
          )
            ? 'permission'
            : event.error === 'audio-capture'
              ? 'microphone'
              : event.error === 'no-speech'
                ? 'noSpeech'
                : event.error === 'network'
                  ? 'network'
                  : 'failed';
          this.cancel();
          this.error.set('voice.' + key);
        });
      this.finishRecognition = (abort) => {
        if (!current()) return;
        const draft = this.interim();
        const withinLimit = !draft || append(draft);
        this.release(abort);
        if (!withinLimit) {
          this.status.set('');
          this.error.set('voice.limit');
        } else if (draft || committed.size) {
          this.status.set(draft ? 'voice.draftSaved' : 'voice.finished');
        } else {
          this.status.set('');
          this.error.set('voice.noSpeech');
        }
      };
      recognition.onend = () =>
        this.zone.run(() => {
          if (current()) this.finishRecognition?.(false);
        });
      this.timer = setTimeout(() => this.zone.run(() => this.stop()), 120000);
      recognition.start();
    } catch {
      this.cancel();
      this.error.set('voice.failed');
    }
  }

  stop(): void {
    if (!this.recognition || this.stopping()) return;
    this.stopping.set(true);
    this.status.set('voice.stopping');
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.zone.run(() => this.finishRecognition?.(true)),
      8000,
    );
    try {
      this.recognition.stop();
    } catch {
      this.cancel();
    }
  }

  cancel(): void {
    this.release(true);
    this.status.set('');
  }

  private release(abort: boolean): void {
    clearTimeout(this.timer);
    const recognition = this.recognition;
    this.recognition = null;
    this.finishRecognition = null;
    if (recognition) {
      recognition.onstart =
        recognition.onend =
        recognition.onerror =
        recognition.onresult =
          null;
      if (abort) {
        try {
          recognition.abort();
        } catch {
          /* Already disconnected. */
        }
      }
    }
    this.active.set(false);
    this.stopping.set(false);
    this.interim.set('');
  }
}
