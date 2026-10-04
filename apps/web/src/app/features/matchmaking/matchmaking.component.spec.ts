import { of } from 'rxjs';
import { PilotMatchesService } from './pilots/pilot-matches.service';
import { DomSanitizer } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { createApiSuccess, type MatchmakingData } from '@repo/api-contracts';
import { ApiConfigService } from '../../core/services/api-config.service';
import { MatchmakingComponent } from './matchmaking.component';

const result: MatchmakingData = {
  catalog: { version: 1, innovationCount: 15 },
  relatedInformation: [
    {
      id: 'mapa-seniorzy',
      title: 'Samotność seniorów',
      summary: 'Kontekst problemu.',
      scope: 'national',
      sourceUrl:
        'https://rops.krakow.pl/pliki-do-pobrania/artykul%2Cmapa-wyzwan-spolecznych%2C1048',
      sourceLabel: 'Mapa Wyzwań Społecznych',
      verifiedAt: '2026-10-03',
      areas: ['Seniorzy'],
      needs: ['Relacje społeczne'],
    },
  ],
  interpretation: {
    summary: 'Seniorzy potrzebują wspólnych spotkań.',
    audiences: ['Seniorzy'],
    areas: ['Seniorzy'],
    needs: ['Relacje społeczne'],
    missingInformation: [],
  },
  matches: [
    {
      id: 'senior-cuder',
      name: 'Senior CUDER',
      description: 'Gra do wspólnych spotkań.',
      audiences: ['Seniorzy'],
      areas: ['Seniorzy'],
      needs: ['Relacje społeczne'],
      sourceUrl:
        'https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-seniorow%2Csenior-cuder',
      verifiedAt: '2026-10-03',
      score: 100,
      level: 'high',
      matchedNeeds: ['Relacje społeczne'],
      explanation: 'Wspólne potrzeby: Relacje społeczne.',
    },
  ],
};

describe('MatchmakingComponent', () => {
  let fixture: ComponentFixture<MatchmakingComponent>;
  let http: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchmakingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
        {
          provide: PilotMatchesService,
          useValue: { match: () => of({ matches: [] }) },
        },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('pl', {
      matchmaking: {
        scopes: { national: 'Kontekst ogólnopolski' },
        examples: {
          seniors: { description: 'Seniorzy czują się samotni.' },
          migrants: {
            description: 'Migranci potrzebują informacji o przychodni.',
          },
          homelessness: {
            description:
              'Nie mam stałego miejsca zamieszkania. Potrzebuję wsparcia.',
          },
          pilot: { description: 'Chcemy przetestować mapę punktów pomocy.' },
        },
      },
    });
    translate.use('pl');
    const sanitizer = TestBed.inject(DomSanitizer);
    const blankPreview =
      sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    spyOn(sanitizer, 'bypassSecurityTrustResourceUrl').and.returnValue(
      blankPreview,
    );
    fixture = TestBed.createComponent(MatchmakingComponent);
    root = fixture.nativeElement;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => {
    http.verify();
  });

  function submitDescription(value = 'Seniorzy potrzebują spotkań.'): void {
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea');
    if (!textarea) throw new Error('Textarea missing');
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('submits the written description, shows loading and prevents duplicate requests', () => {
    submitDescription();
    const req = http.expectOne('/api/matchmaking');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      description: 'Seniorzy potrzebują spotkań.',
    });
    expect(
      root.querySelector<HTMLTextAreaElement>('textarea')?.disabled,
    ).toBeTrue();
    expect(root.querySelector('mat-progress-bar')).not.toBeNull();
    fixture.componentInstance.submit();
    http.expectNone('/api/matchmaking');
    req.flush(createApiSuccess(result));
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(
      root.querySelector<HTMLTextAreaElement>('textarea')?.disabled,
    ).toBeFalse();
  });

  it('renders interpretation, needs, cards and trusted source links', () => {
    submitDescription();
    http.expectOne('/api/matchmaking').flush(createApiSuccess(result));
    fixture.detectChanges();
    expect(root.querySelector('.interpretation')?.textContent).toContain(
      result.interpretation.summary,
    );
    expect(root.querySelector('.innovation-card')?.textContent).toContain(
      'Senior CUDER',
    );
    expect(root.querySelector('.need-tags')?.textContent).toContain(
      'Relacje społeczne',
    );
    expect(root.querySelector('.innovation-card iframe')).toBeNull();
    root.querySelector<HTMLButtonElement>('.preview-toggle')?.click();
    fixture.detectChanges();
    const link = root.querySelector<HTMLAnchorElement>('.innovation-card a');
    expect(link?.href).toBe(result.matches[0].sourceUrl);
    expect(link?.rel).toContain('noopener');
    expect(root.querySelector('.related-information')?.textContent).toContain(
      'Samotność seniorów',
    );
    expect(root.querySelector('.scope')?.textContent).toContain(
      'Kontekst ogólnopolski',
    );
    expect(
      root.querySelector<HTMLAnchorElement>('.information-card a')?.href,
    ).toBe(result.relatedInformation[0].sourceUrl);
  });

  it('expands a source preview on demand and collapses without losing the search', async () => {
    submitDescription();
    http.expectOne('/api/matchmaking').flush(createApiSuccess(result));
    fixture.detectChanges();
    const toggle = root.querySelector<HTMLButtonElement>('.preview-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('iframe')).toBeNull();
    toggle?.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    const frame = root.querySelector('iframe');
    expect(frame?.getAttribute('title')).toBeTruthy();
    expect(frame?.getAttribute('sandbox')).not.toContain(
      'allow-top-navigation',
    );
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-popups');
    expect(
      TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl,
    ).toHaveBeenCalledWith(result.matches[0].sourceUrl + '#content');
    frame?.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(root.querySelector('.preview-status')).toBeNull();
    root.querySelector<HTMLButtonElement>('.preview-close')?.click();
    fixture.detectChanges();
    expect(root.querySelector('iframe')).toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    await fixture.whenStable();
    expect(document.activeElement).toBe(toggle);
    expect(fixture.componentInstance.result()).toEqual(result);
    expect(fixture.componentInstance.description.value).toBe(
      'Seniorzy potrzebują spotkań.',
    );
    http.expectNone('/api/matchmaking');
  });

  it('keeps only one preview and clears it when results are replaced or edited', () => {
    const second = {
      ...result.matches[0],
      id: 'other-innovation',
      name: 'Druga innowacja',
    };
    submitDescription();
    http
      .expectOne('/api/matchmaking')
      .flush(
        createApiSuccess({ ...result, matches: [...result.matches, second] }),
      );
    fixture.detectChanges();
    const toggles = root.querySelectorAll<HTMLButtonElement>('.preview-toggle');
    toggles[0].click();
    fixture.detectChanges();
    toggles[1].click();
    fixture.componentInstance.previewLoaded(result.matches[0].id);
    expect(fixture.componentInstance.previewLoading()).toBeTrue();
    fixture.detectChanges();
    expect(root.querySelectorAll('iframe').length).toBe(1);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
    fixture.componentInstance.submit();
    http.expectOne('/api/matchmaking').flush(createApiSuccess(result));
    fixture.detectChanges();
    expect(root.querySelector('iframe')).toBeNull();
    fixture.componentInstance.togglePreview(result.matches[0]);
    fixture.componentInstance.description.setValue('Inna potrzeba.');
    fixture.detectChanges();
    expect(fixture.componentInstance.preview()).toBeNull();
    expect(root.querySelector('iframe')).toBeNull();
  });

  it('does not trust source URLs outside the HTTPS ROPS innovation library', () => {
    for (const sourceUrl of [
      'javascript:alert(1)',
      'https://example.org/innovation',
      'http://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/test',
      'https://rops.krakow.pl/other-page',
      'https://rops.krakow.pl:8443/innowacje-spoleczne/biblioteka-innowacji-spolecznych/test',
      'https://user@rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/test',
    ])
      fixture.componentInstance.togglePreview({
        ...result.matches[0],
        sourceUrl,
      });
    expect(fixture.componentInstance.preview()).toBeNull();
    expect(
      TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl,
    ).not.toHaveBeenCalled();
  });

  it('focuses the interpretation after completing a search and returns to the description for refinement', async () => {
    submitDescription();
    http.expectOne('/api/matchmaking').flush(createApiSuccess(result));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('interpretation-title');
    root.querySelector<HTMLButtonElement>('.interpretation button')?.click();
    expect(document.activeElement?.id).toBe('problem-description');
  });

  it('renders an empty state and clarification without invented results', () => {
    submitDescription('Chcemy pomóc.');
    http.expectOne('/api/matchmaking').flush(
      createApiSuccess({
        interpretation: {
          ...result.interpretation,
          needs: [],
          missingInformation: ['Kogo wspieracie?'],
        },
        matches: [],
        relatedInformation: [],
        catalog: result.catalog,
      }),
    );
    fixture.detectChanges();
    expect(root.querySelector('.empty-state')).not.toBeNull();
    expect(root.textContent).toContain('Kogo wspieracie?');
    expect(root.querySelector('.innovation-card')).toBeNull();
  });

  it('shows an API error and retries the same description', () => {
    submitDescription();
    http
      .expectOne('/api/matchmaking')
      .flush(
        { success: false, error: { code: 'AI_TIMEOUT', message: 'timeout' } },
        { status: 504, statusText: 'Gateway Timeout' },
      );
    fixture.detectChanges();
    expect(fixture.componentInstance.errorKey()).toBe(
      'matchmaking.errors.timeout',
    );
    expect(root.querySelector('[role=alert]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.error-state button')?.click();
    http.expectOne('/api/matchmaking').flush(createApiSuccess(result));
    fixture.detectChanges();
    expect(root.querySelector('.error-state')).toBeNull();
    expect(root.querySelector('.innovation-card')).not.toBeNull();
  });

  it('handles network errors and invalid server responses', () => {
    submitDescription();
    http.expectOne('/api/matchmaking').error(new ProgressEvent('error'));
    expect(fixture.componentInstance.errorKey()).toBe(
      'matchmaking.errors.generic',
    );
    fixture.componentInstance.submit();
    http
      .expectOne('/api/matchmaking')
      .flush({ success: true, data: { matches: [] } });
    expect(fixture.componentInstance.errorKey()).toBe(
      'matchmaking.errors.generic',
    );
  });

  it('uses a configured production API URL', () => {
    TestBed.inject(ApiConfigService).apiUrl = 'https://api.example.org/api';
    submitDescription();
    http
      .expectOne('https://api.example.org/api/matchmaking')
      .flush(createApiSuccess(result));
    expect(fixture.componentInstance.result()).toEqual(result);
  });

  it('clears old results when the description changes', () => {
    submitDescription();
    http.expectOne('/api/matchmaking').flush(createApiSuccess(result));
    fixture.componentInstance.description.setValue('Nowy opis.');
    fixture.detectChanges();
    expect(root.querySelector('.results')).toBeNull();
  });

  it('rejects empty, whitespace and overlong descriptions', () => {
    for (const value of ['', '   ', 'x'.repeat(4001)]) {
      fixture.componentInstance.description.setValue(value);
      fixture.componentInstance.submit();
      expect(fixture.componentInstance.description.invalid).toBeTrue();
    }
    http.expectNone('/api/matchmaking');
    expect(root.querySelector('textarea')?.getAttribute('maxlength')).toBe(
      '4000',
    );
  });

  it('offers all four editable examples without automatically calling AI', () => {
    expect(root.querySelectorAll('.examples button').length).toBe(4);
    const texts = new Set<string>();
    for (const example of fixture.componentInstance.examples) {
      fixture.componentInstance.useExample(example);
      texts.add(fixture.componentInstance.description.value);
    }
    expect(texts.size).toBe(4);
    expect(fixture.componentInstance.description.value).toBe(
      'Chcemy przetestować mapę punktów pomocy.',
    );
    http.expectNone('/api/matchmaking');
  });
  function showClarification(options?: string[]): void {
    submitDescription('Chcemy pomóc.');
    http.expectOne('/api/matchmaking').flush(
      createApiSuccess({
        ...result,
        matches: [],
        clarification: {
          reason: 'no_matches',
          question: 'Komu pomagamy?',
          options,
          round: 1,
          maxRounds: 3,
          totalMatches: 0,
        },
      }),
    );
    fixture.detectChanges();
  }

  it('asks one question, validates the answer and searches using the conversation', async () => {
    showClarification();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('clarification-heading');
    expect(root.querySelectorAll('.clarification-card textarea').length).toBe(
      1,
    );
    fixture.componentInstance.answer.setValue('   ');
    fixture.componentInstance.submitAnswer();
    http.expectNone('/api/matchmaking');
    fixture.componentInstance.answer.setValue('Seniorom brakuje spotkań.');
    root
      .querySelector('.clarification-card form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    const req = http.expectOne('/api/matchmaking');
    expect(req.request.body).toEqual({
      description: 'Chcemy pomóc.',
      answers: [
        { question: 'Komu pomagamy?', answer: 'Seniorom brakuje spotkań.' },
      ],
    });
    fixture.componentInstance.submitAnswer();
    http.expectNone('/api/matchmaking');
    req.flush(createApiSuccess(result));
    fixture.detectChanges();
    expect(root.querySelector('.clarification-card')).toBeNull();
    expect(root.querySelector('.innovation-card')).not.toBeNull();
  });

  it('preserves the answer and previous result on failure and retries without duplicating history', () => {
    showClarification();
    fixture.componentInstance.answer.setValue('Seniorom.');
    fixture.componentInstance.submitAnswer();
    const req = http.expectOne('/api/matchmaking');
    const body = req.request.body;
    req.flush(
      { success: false, error: { code: 'AI_TIMEOUT', message: 'timeout' } },
      { status: 504, statusText: 'Timeout' },
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.answer.value).toBe('Seniorom.');
    expect(fixture.componentInstance.answers()).toEqual([]);
    expect(root.querySelector('.clarification-card')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.error-state button')?.click();
    const retry = http.expectOne('/api/matchmaking');
    expect(retry.request.body).toEqual(body);
    retry.flush(createApiSuccess(result));
    expect(fixture.componentInstance.answers().length).toBe(1);
    fixture.componentInstance.description.setValue('Nowy problem.');
    expect(fixture.componentInstance.answers()).toEqual([]);
    expect(fixture.componentInstance.answer.value).toBe('');
  });

  it('allows skipping questions without discarding results', () => {
    showClarification();
    fixture.componentInstance.dismissClarification();
    fixture.detectChanges();
    expect(root.querySelector('.clarification-card')).toBeNull();
    expect(root.querySelector('.results')).not.toBeNull();
    expect(root.querySelector('.clarification-resume')).not.toBeNull();
    http.expectNone('/api/matchmaking');
  });

  it('offers contact instead of more questions when the round limit is reached', () => {
    submitDescription();
    http.expectOne('/api/matchmaking').flush(
      createApiSuccess({
        ...result,
        clarification: {
          reason: 'too_many_matches',
          question: null,
          round: 3,
          maxRounds: 3,
          totalMatches: 8,
        },
      }),
    );
    fixture.detectChanges();
    expect(root.querySelector('.clarification-card textarea')).toBeNull();
    expect(
      root.querySelector('.clarification-card a')?.getAttribute('href'),
    ).toBe('/rops-contact');
    expect(root.querySelector('.innovation-card')).not.toBeNull();
  });

  it('shows three choices and other, and waits for submission before searching', () => {
    showClarification(['Sobie.', 'Bliskiej osobie.', 'Grupie mieszkańców.']);
    expect(root.querySelectorAll('mat-radio-button').length).toBe(4);
    expect(root.querySelector('.clarification-card textarea')).toBeNull();
    fixture.componentInstance.submitAnswer();
    fixture.detectChanges();
    expect(root.querySelector('#choice-error')).not.toBeNull();
    root.querySelector<HTMLInputElement>('mat-radio-button input')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.answer.value).toBe('Sobie.');
    http.expectNone('/api/matchmaking');
    fixture.componentInstance.submitAnswer();
    const request = http.expectOne('/api/matchmaking');
    expect(request.request.body.answers).toEqual([
      { question: 'Komu pomagamy?', answer: 'Sobie.' },
    ]);
    request.flush(createApiSuccess(result));
  });

  it('opens a custom answer and keeps its draft when switching choices', async () => {
    showClarification(['Sobie.', 'Bliskiej osobie.', 'Grupie mieszkańców.']);
    const radios = root.querySelectorAll<HTMLInputElement>(
      'mat-radio-button input',
    );
    radios[3]?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const textarea = root.querySelector<HTMLTextAreaElement>(
      '.clarification-card textarea',
    );
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
    fixture.componentInstance.answer.setValue(
      'Osobom bez stałego miejsca zamieszkania.',
    );
    radios[0]?.click();
    fixture.detectChanges();
    radios[3]?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.answer.value).toBe(
      'Osobom bez stałego miejsca zamieszkania.',
    );
    fixture.componentInstance.submitAnswer();
    const request = http.expectOne('/api/matchmaking');
    expect(request.request.body.answers[0].answer).toBe(
      'Osobom bez stałego miejsca zamieszkania.',
    );
    request.flush(
      { success: false, error: { code: 'AI_TIMEOUT', message: 'Timeout' } },
      { status: 504, statusText: 'Timeout' },
    );
    expect(fixture.componentInstance.selectedOption()).toBe(-1);
    expect(fixture.componentInstance.answer.value).toBe(
      'Osobom bez stałego miejsca zamieszkania.',
    );
  });
});
