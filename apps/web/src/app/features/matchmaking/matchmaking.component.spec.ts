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
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
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
          school: { description: 'Uczniowie wracają po terapii.' },
        },
      },
    });
    translate.use('pl');
    fixture = TestBed.createComponent(MatchmakingComponent);
    root = fixture.nativeElement;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

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

  it('offers all three editable examples without automatically calling AI', () => {
    expect(root.querySelectorAll('.examples button').length).toBe(3);
    const texts = new Set<string>();
    for (const example of fixture.componentInstance.examples) {
      fixture.componentInstance.useExample(example);
      texts.add(fixture.componentInstance.description.value);
    }
    expect(texts.size).toBe(3);
    expect(fixture.componentInstance.description.value).toBe(
      'Uczniowie wracają po terapii.',
    );
    http.expectNone('/api/matchmaking');
  });
});
