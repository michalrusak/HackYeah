import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MatchmakingComponent } from './matchmaking.component';
import {
  SPEECH_RECOGNIZER,
  type SpeechRecognizer,
  type SpeechResultEvent,
} from './speech-input.service';

class FakeRecognizer implements SpeechRecognizer {
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  start = jasmine.createSpy('start');
  stop = jasmine.createSpy('stop');
  abort = jasmine.createSpy('abort');
  result(parts: [string, boolean][]): void {
    this.onresult?.({
      results: parts.map(([transcript, isFinal]) => ({
        isFinal,
        0: { transcript },
      })),
    });
  }
}

describe('Matchmaking voice input', () => {
  let fixture: ComponentFixture<MatchmakingComponent>;
  let recognition: FakeRecognizer;
  let http: HttpTestingController;
  async function setup(supported = true): Promise<void> {
    recognition = new FakeRecognizer();
    await TestBed.configureTestingModule({
      imports: [MatchmakingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
        {
          provide: SPEECH_RECOGNIZER,
          useValue: supported ? () => recognition : null,
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MatchmakingComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  function click(): void {
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.dictation-toggle')?.click();
    fixture.detectChanges();
  }
  afterEach(() => {
    fixture?.destroy();
    http?.verify();
  });

  it('requests Polish recognition only after clicking the accessible microphone', async () => {
    await setup();
    const root: HTMLElement = fixture.nativeElement;
    expect(recognition.start).not.toHaveBeenCalled();
    expect(
      root.querySelector('.dictation-toggle')?.getAttribute('aria-label'),
    ).toBe('voice.start');
    click();
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.lang).toBe('pl-PL');
    recognition.onstart?.();
    fixture.detectChanges();
    expect(
      root.querySelector('.dictation-toggle')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(root.textContent).toContain('voice.listening');
    expect(
      root.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled,
    ).toBeTrue();
    fixture.componentInstance.submit();
    http.expectNone('/api/matchmaking');
  });
  it('preserves existing text, shows interim words separately and appends each final segment once', async () => {
    await setup();
    const component = fixture.componentInstance;
    component.description.setValue('Prowadzimy klub.');
    click();
    recognition.result([['Seniorzy potrzebują', false]]);
    expect(component.description.value).toBe('Prowadzimy klub.');
    expect(component.voice.interim()).toBe('Seniorzy potrzebują');
    recognition.result([['Seniorzy potrzebują spotkań.', true]]);
    recognition.result([
      ['Seniorzy potrzebują spotkań.', true],
      ['Raz w tygodniu.', true],
    ]);
    expect(component.description.value).toBe(
      'Prowadzimy klub. Seniorzy potrzebują spotkań. Raz w tygodniu.',
    );
    expect(component.description.dirty).toBeTrue();
    http.expectNone('/api/matchmaking');
  });
  it('waits for the final transcript after stop and allows editing afterwards', async () => {
    await setup();
    click();
    recognition.onstart?.();
    click();
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.voice.stopping()).toBeTrue();
    recognition.result([['Końcowa wypowiedź.', true]]);
    recognition.onend?.();
    fixture.detectChanges();
    expect(fixture.componentInstance.voice.active()).toBeFalse();
    expect(fixture.componentInstance.description.value).toBe(
      'Końcowa wypowiedź.',
    );
    const root: HTMLElement = fixture.nativeElement;
    expect(
      root.querySelector<HTMLTextAreaElement>('textarea')?.disabled,
    ).toBeFalse();
    expect(
      root.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled,
    ).toBeFalse();
  });
  it('handles permission denial without erasing the text and permits another attempt', async () => {
    await setup();
    fixture.componentInstance.description.setValue('Mój opis.');
    click();
    recognition.onerror?.({ error: 'not-allowed' });
    fixture.detectChanges();
    expect(fixture.componentInstance.voice.error()).toBe('voice.permission');
    expect(fixture.componentInstance.description.value).toBe('Mój opis.');
    expect(fixture.componentInstance.voice.active()).toBeFalse();
    click();
    expect(recognition.start).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.voice.error()).toBeNull();
  });
  it('shows a useful fallback in browsers without speech recognition', async () => {
    await setup(false);
    click();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('voice.unsupported');
    expect(recognition.start).not.toHaveBeenCalled();
    expect(
      root.querySelector<HTMLTextAreaElement>('textarea')?.disabled,
    ).toBeFalse();
  });
  it('limits appended text to 4000 characters and stops the microphone', async () => {
    await setup();
    fixture.componentInstance.description.setValue('x'.repeat(3996));
    click();
    recognition.result([['długi tekst', true]]);
    expect(fixture.componentInstance.description.value.length).toBe(4000);
    expect(fixture.componentInstance.voice.error()).toBe('voice.limit');
    expect(recognition.abort).toHaveBeenCalled();
    expect(fixture.componentInstance.voice.active()).toBeFalse();
  });
  it('releases the microphone on navigation and ignores late callbacks', async () => {
    await setup();
    click();
    const late = recognition.onresult;
    const component = fixture.componentInstance;
    fixture.destroy();
    expect(recognition.abort).toHaveBeenCalled();
    late?.({
      results: [{ isFinal: true, 0: { transcript: 'Spóźniona wypowiedź' } }],
    });
    expect(component.description.value).toBe('');
  });
  it('handles startup exceptions and missing speech without leaving a stuck microphone', async () => {
    await setup();
    recognition.start.and.throwError('unavailable');
    click();
    expect(fixture.componentInstance.voice.error()).toBe('voice.failed');
    expect(fixture.componentInstance.voice.active()).toBeFalse();
    recognition.start.and.stub();
    click();
    recognition.onend?.();
    expect(fixture.componentInstance.voice.error()).toBe('voice.noSpeech');
    expect(fixture.componentInstance.voice.active()).toBeFalse();
  });
  it('keeps the latest interim transcript when recognition ends without a final result', async () => {
    await setup();
    const component = fixture.componentInstance;
    component.description.setValue('Mój opis.');
    click();
    recognition.result([['Chcemy', false]]);
    recognition.result([['Chcemy spotkań dla seniorów.', false]]);
    recognition.onend?.();
    expect(component.description.value).toBe(
      'Mój opis. Chcemy spotkań dla seniorów.',
    );
    expect(component.voice.status()).toBe('voice.draftSaved');
    expect(component.voice.error()).toBeNull();
    expect(component.voice.active()).toBeFalse();
  });
  it('keeps pending words once when stop times out and ignores late final results', async () => {
    await setup();
    jasmine.clock().install();
    try {
      click();
      recognition.result([
        ['Potrzebujemy pomocy.', true],
        ['W naszej gminie.', false],
      ]);
      const late = recognition.onresult;
      click();
      jasmine.clock().tick(8000);
      expect(recognition.abort).toHaveBeenCalled();
      expect(fixture.componentInstance.voice.active()).toBeFalse();
      late?.({
        results: [{ isFinal: true, 0: { transcript: 'Spóźniony wynik.' } }],
      });
      expect(fixture.componentInstance.description.value).toBe(
        'Potrzebujemy pomocy. W naszej gminie.',
      );
    } finally {
      jasmine.clock().uninstall();
    }
  });
  it('does not commit interim text after intentional cancellation', async () => {
    await setup();
    click();
    recognition.result([['Niedokończony opis', false]]);
    fixture.componentInstance.voice.cancel();
    expect(fixture.componentInstance.description.value).toBe('');
    expect(fixture.componentInstance.voice.interim()).toBe('');
  });
});
