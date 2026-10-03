import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import {
  createApiSuccess,
  type TesterProfile,
  type TesterSearchData,
} from '@repo/api-contracts';
import { TestersComponent } from './testers.component';
import { TestersService } from './testers.service';

const profile: TesterProfile = {
  id: '12345678-1234-4123-8123-123456789012',
  displayName: 'Ala Testowa',
  city: 'Kraków',
  bio: 'Testuję aplikacje i udostępniam mocny komputer.',
  skills: ['Testowanie'],
  resources: ['Mocny komputer'],
  interests: ['Innowacje społeczne'],
  accessibilityNeeds: '',
  availability: 'remote',
  consent: true,
  isActive: true,
  isDemo: true,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};
const search: TesterSearchData = {
  id: '12345678-1234-4123-8123-123456789013',
  query: 'Szukam mocnego komputera do testów.',
  summary: 'Potrzebna jest osoba z mocnym komputerem.',
  matches: [
    {
      profile,
      score: 92,
      reason: 'Ala deklaruje mocny komputer.',
      matchedTraits: ['Mocny komputer'],
    },
  ],
  assignedProfileIds: [],
  staleMatchCount: 0,
  candidateCount: 1,
  totalProfiles: 1,
  candidateLimit: 100,
  createdAt: '2026-10-03T11:00:00.000Z',
};

describe('TestersComponent', () => {
  let fixture: ComponentFixture<TestersComponent>;
  let http: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestersComponent);
    root = fixture.nativeElement;
    http
      .expectOne('/api/testers/profiles')
      .flush(createApiSuccess({ profiles: [profile], total: 1, limit: 100 }));
    http
      .expectOne('/api/testers/profile/me')
      .flush(createApiSuccess({ profile: null }));
    http
      .expectOne('/api/testers/searches')
      .flush(createApiSuccess({ searches: [] }));
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function submit(): void {
    fixture.componentInstance.query.setValue(search.query);
    fixture.componentInstance.search();
    fixture.detectChanges();
  }

  it('loads the public database catalog with explicit demo badges', () => {
    expect(root.querySelector('app-tester-card')?.textContent).toContain(
      'Ala Testowa',
    );
    expect(root.querySelector('.demo-badge')).not.toBeNull();
    expect(fixture.componentInstance.total()).toBe(1);
    expect(fixture.componentInstance.initialLoading()).toBeFalse();
    expect(root.querySelector('.assign-button')).toBeNull();
  });

  it('validates requirements before calling AI', () => {
    for (const value of ['', '       ', 'krótki', 'x'.repeat(2001)]) {
      fixture.componentInstance.query.setValue(value);
      fixture.componentInstance.search();
      expect(fixture.componentInstance.query.invalid).toBeTrue();
    }
    http.expectNone('/api/testers/search');
  });

  it('sends an owner key, prevents duplicate searches and renders real AI explanations', () => {
    submit();
    const request = http.expectOne('/api/testers/search');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Tester-Key')).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(request.request.body).toEqual({ query: search.query });
    expect(root.querySelector('mat-progress-bar')).not.toBeNull();
    fixture.componentInstance.search();
    http.expectNone('/api/testers/search');
    request.flush(createApiSuccess(search));
    fixture.detectChanges();
    expect(root.querySelector('.match-explanation')?.textContent).toContain(
      'Ala deklaruje mocny komputer.',
    );
    expect(root.querySelector('.score-row strong')?.textContent).toBe('92%');
    expect(fixture.componentInstance.history().length).toBe(1);
  });

  it('persists selections and removals on the saved search', () => {
    submit();
    http.expectOne('/api/testers/search').flush(createApiSuccess(search));
    fixture.componentInstance.toggleAssignment(profile.id);
    const request = http.expectOne(
      `/api/testers/searches/${search.id}/assignments`,
    );
    expect(request.request.body).toEqual({ profileId: profile.id });
    request.flush(
      createApiSuccess({ ...search, assignedProfileIds: [profile.id] }),
    );
    fixture.detectChanges();
    expect(
      root.querySelector('.tester-card')?.classList.contains('is-assigned'),
    ).toBeTrue();
    expect(fixture.componentInstance.history()[0].assignedCount).toBe(1);
    fixture.componentInstance.toggleAssignment(profile.id);
    const removal = http.expectOne(
      `/api/testers/searches/${search.id}/assignments/${profile.id}`,
    );
    expect(removal.request.method).toBe('DELETE');
    removal.flush(createApiSuccess(search));
    expect(fixture.componentInstance.result()?.assignedProfileIds).toEqual([]);
  });

  it('reopens saved results without calling AI and clears them when the query changes', () => {
    fixture.componentInstance.openSearch(search.id);
    http
      .expectOne(`/api/testers/searches/${search.id}`)
      .flush(createApiSuccess(search));
    expect(fixture.componentInstance.query.value).toBe(search.query);
    expect(fixture.componentInstance.result()?.id).toBe(search.id);
    fixture.componentInstance.query.setValue('Nowe wymagania dotyczące testu.');
    expect(fixture.componentInstance.result()).toBeNull();
    http.expectNone('/api/testers/search');
  });

  it('handles timeout and empty results without inventing candidates', () => {
    submit();
    http
      .expectOne('/api/testers/search')
      .flush(
        { success: false, error: { code: 'AI_TIMEOUT', message: 'timeout' } },
        { status: 504, statusText: 'Gateway Timeout' },
      );
    expect(fixture.componentInstance.searchError()).toBe(
      'testers.errors.timeout',
    );
    expect(fixture.componentInstance.searching()).toBeFalse();
    fixture.componentInstance.search();
    http
      .expectOne('/api/testers/search')
      .flush(createApiSuccess({ ...search, matches: [] }));
    fixture.detectChanges();
    expect(root.querySelector('.empty-state')).not.toBeNull();
    expect(root.querySelector('app-tester-card')).toBeNull();
  });

  it('keeps the current identity when a well-formed recovery key owns no data', () => {
    const service = TestBed.inject(TestersService);
    const currentKey = service.getKey();
    let failed = false;
    service.restoreKey('a'.repeat(64)).subscribe({
      error: () => {
        failed = true;
      },
    });
    http
      .expectOne('/api/testers/profile/me')
      .flush(createApiSuccess({ profile: null }));
    http
      .expectOne('/api/testers/searches')
      .flush(createApiSuccess({ searches: [] }));
    expect(failed).toBeTrue();
    expect(service.getKey()).toBe(currentKey);
  });

  it('explains that changed profiles require a new search instead of displaying stale matches', () => {
    fixture.componentInstance.openSearch(search.id);
    http
      .expectOne(`/api/testers/searches/${search.id}`)
      .flush(createApiSuccess({ ...search, matches: [], staleMatchCount: 1 }));
    fixture.detectChanges();
    expect(root.querySelector('.stale-note')?.textContent).toContain(
      'testers.staleMatches',
    );
    expect(root.querySelector('.empty-state')?.textContent).toContain(
      'testers.staleResultsDescription',
    );
    expect(root.querySelector('app-tester-card')).toBeNull();
  });
});
