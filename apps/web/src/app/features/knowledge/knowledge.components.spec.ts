import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import {
  KnowledgeResourceSchema,
  type KnowledgeResource,
} from '@repo/api-contracts';
import { of } from 'rxjs';
import { KnowledgeTopicComponent } from './knowledge-topic.component';
import { ResourceCardComponent } from './resource-card.component';
import { KnowledgeAdminComponent } from './knowledge-admin.component';
import { IdeaModerationComponent } from './idea-moderation.component';
import { ResourceEditorComponent } from './resource-editor.component';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeComponent } from './knowledge.component';

const resource: KnowledgeResource = KnowledgeResourceSchema.parse({
  id: 'fixture-senior',
  title: 'Fikcyjna innowacja',
  summary: 'Opis do testu.',
  kind: 'innovation',
  scope: 'general',
  areas: ['Seniorzy'],
  audiences: ['Seniorzy'],
  needs: ['Relacje społeczne'],
  sourceUrl:
    'https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/kategorie',
  sourceLabel: 'ROPS',
  verifiedAt: '2026-10-03',
  publicationYear: null,
  videoPageUrl: null,
  status: 'published',
  revision: 3,
  updatedAt: '2026-10-03T12:00:00.000Z',
});
const session = {
  csrfToken: 'a'.repeat(64),
  expiresAt: '2026-10-03T23:00:00.000Z',
};
const providers = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideNoopAnimations(),
  provideRouter([]),
  provideTranslateService(),
];

describe('Knowledge discovery', () => {
  function create(
    params: Record<string, string> = {},
  ): ComponentFixture<KnowledgeComponent> {
    const queryParamMap = convertToParamMap(params);
    TestBed.configureTestingModule({
      imports: [KnowledgeComponent],
      providers: [
        ...providers,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(queryParamMap),
            snapshot: { queryParamMap },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(KnowledgeComponent);
    fixture.detectChanges();
    return fixture;
  }

  function respond(overviewFails = false): void {
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((request) =>
        request.url.startsWith('/api/knowledge/resources?'),
      )
      .flush({
        success: true,
        data: { resources: [resource], total: 1, page: 1, pageSize: 12 },
      });
    const overview = http.expectOne('/api/knowledge/overview');
    if (overviewFails)
      overview.flush({}, { status: 503, statusText: 'Unavailable' });
    else
      overview.flush({
        success: true,
        data: {
          total: 1,
          areas: [{ area: 'Seniorzy', count: 1 }],
          updatedAt: null,
        },
      });
    http.verify();
  }

  it('restores shareable filters and removes just the chosen filter while resetting pagination', () => {
    const fixture = create({
      area: 'Seniorzy',
      kind: 'innovation',
      video: '1',
      page: '2',
    });
    respond();
    expect(
      fixture.componentInstance.activeFilters().map((filter) => filter.key),
    ).toEqual(['area', 'kind', 'video']);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.componentInstance.removeFilter('video');
    const url = router.parseUrl(String(navigate.calls.mostRecent().args[0]));
    expect(url.queryParams['area']).toBe('Seniorzy');
    expect(url.queryParams['kind']).toBe('innovation');
    expect(url.queryParams['video']).toBeUndefined();
    expect(url.queryParams['page']).toBe('1');
  });

  it('starts a situation from clean filters instead of retaining an unrelated search', () => {
    const fixture = create({ q: 'szkoła', scope: 'national', video: '1' });
    respond();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.componentInstance.chooseSituation('Seniorzy');
    const url = router.parseUrl(String(navigate.calls.mostRecent().args[0]));
    expect(url.queryParams).toEqual({ area: 'Seniorzy', kind: 'innovation' });
    fixture.componentInstance.choosePath('education');
    expect(
      router.parseUrl(String(navigate.calls.mostRecent().args[0])).queryParams,
    ).toEqual({ kind: 'education' });
  });

  it('keeps materials available if optional topic counts cannot be loaded', () => {
    const fixture = create();
    respond(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBeNull();
    expect(fixture.componentInstance.result()?.resources).toEqual([resource]);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-resource-card')).not.toBeNull();
    expect(element.querySelector('.tile-count')).toBeNull();
  });
});

describe('Knowledge administrator access', () => {
  let fixture: ComponentFixture<KnowledgeAdminComponent>;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnowledgeAdminComponent],
      providers,
    }).compileComponents();
    fixture = TestBed.createComponent(KnowledgeAdminComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('does not request or display trends when session verification fails', () => {
    http
      .expectOne('/api/knowledge/admin/session')
      .flush(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'test' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();
    expect(fixture.componentInstance.service.session()).toBeNull();
    http.expectNone('/api/knowledge/admin/trends');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('shows a clear login error and permits another attempt', () => {
    http
      .expectOne('/api/knowledge/admin/session')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const component = fixture.componentInstance;
    component.form.controls.password.setValue('test-password');
    component.login();
    const login = http.expectOne('/api/knowledge/admin/login');
    expect(login.request.withCredentials).toBeTrue();
    login.flush(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'test' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(component.error()).toBe('knowledge.errors.unauthorized');
    expect(component.loading()).toBeFalse();
    expect(component.service.session()).toBeNull();
  });
});

describe('Knowledge administrator quick actions', () => {
  it('verifies and publishes a draft in one step with the known revision', () => {
    TestBed.configureTestingModule({
      imports: [KnowledgeAdminComponent],
      providers,
    });
    const fixture = TestBed.createComponent(KnowledgeAdminComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/knowledge/admin/session')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const component = fixture.componentInstance;
    component.service.session.set(session);
    component.quick(
      { ...resource, status: 'draft', verifiedAt: '2025-01-15' },
      'publish',
    );
    const request = http.expectOne(
      '/api/knowledge/admin/resources/fixture-senior',
    );
    expect(request.request.body.revision).toBe(3);
    expect(request.request.body.resource.status).toBe('published');
    expect(request.request.body.resource.verifiedAt).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(Object.keys(request.request.body.resource)).not.toContain(
      'updatedAt',
    );
    request.flush(
      { success: false, error: { code: 'CONFLICT', message: 'test' } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.error()).toBe('knowledge.errors.conflict');
    http.verify();
  });

  it('embeds the ROPS source inside the resource card instead of opening a new tab', () => {
    TestBed.configureTestingModule({
      imports: [KnowledgeAdminComponent],
      providers,
    });
    const fixture = TestBed.createComponent(KnowledgeAdminComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/knowledge/admin/session')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const component = fixture.componentInstance;
    component.service.session.set(session);
    component.list.set({
      resources: [resource],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector<HTMLButtonElement>('.source-toggle');
    expect(element.querySelector('iframe')).toBeNull();
    expect(
      element.querySelector('.resource-card a[target="_blank"]'),
    ).toBeNull();

    toggle?.click();
    fixture.detectChanges();
    expect(element.querySelector('iframe')?.getAttribute('src')).toBe(
      resource.sourceUrl,
    );
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    toggle?.click();
    fixture.detectChanges();
    expect(element.querySelector('iframe')).toBeNull();
    http.verify();
  });
});

describe('Idea moderation', () => {
  it('refuses to reject or request changes without a message for the author', () => {
    TestBed.configureTestingModule({
      imports: [IdeaModerationComponent],
      providers,
    });
    TestBed.inject(KnowledgeService).session.set(session);
    const fixture = TestBed.createComponent(IdeaModerationComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('queue', { items: [], attention: 0 });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.open('idea-1');
    const idea = {
      id: 'idea-1',
      title: 'Fikcyjny pomysł',
      essence: 'Opis do testu.',
      problem: 'Problem do testu.',
      targetAudience: 'Mieszkańcy',
      description: '',
      stage: 'POMYSL',
      kind: 'IDEA',
      status: 'SUBMITTED',
      region: '',
      hasContact: false,
      audiences: [],
      areas: [],
      needs: [],
      adoptedFromId: null,
      plainLanguageSummary: null,
      visualId: null,
      visualAltText: null,
      hasCanvas: false,
      unreadReply: false,
      createdAt: '2026-10-03T12:00:00.000Z',
      updatedAt: '2026-10-03T12:00:00.000Z',
    };
    http
      .expectOne('/api/knowledge/admin/ideas/idea-1')
      .flush({ success: true, data: { idea, awaitsRops: true, messages: [] } });
    component.decide('REJECT');
    http.expectNone('/api/knowledge/admin/ideas/idea-1/decision');
    expect(component.errorKey()).toBe('knowledge.admin.ideas.messageRequired');
    component.message.setValue('  Brakuje opisu odbiorców.  ');
    component.decide('REQUEST_CHANGES');
    const request = http.expectOne(
      '/api/knowledge/admin/ideas/idea-1/decision',
    );
    expect(request.request.body).toEqual({
      decision: 'REQUEST_CHANGES',
      message: 'Brakuje opisu odbiorców.',
    });
    expect(request.request.headers.get('X-Knowledge-CSRF')).toBe(
      session.csrfToken,
    );
    request.flush({
      success: true,
      data: {
        idea: { ...idea, status: 'NEEDS_CHANGES' },
        awaitsRops: false,
        messages: [],
      },
    });
    expect(component.noticeKey()).toBe(
      'knowledge.admin.ideas.done.REQUEST_CHANGES',
    );
    http.verify();
  });
});

describe('Resource editor', () => {
  let fixture: ComponentFixture<ResourceEditorComponent>;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourceEditorComponent],
      providers,
    }).compileComponents();
    TestBed.inject(KnowledgeService).session.set(session);
    fixture = TestBed.createComponent(ResourceEditorComponent);
    fixture.componentRef.setInput('resource', resource);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('sends the known revision and CSRF header and retains edits on conflict', () => {
    const component = fixture.componentInstance;
    component.form.controls.title.setValue('Moje nowe zmiany');
    component.save();
    const request = http.expectOne(
      '/api/knowledge/admin/resources/fixture-senior',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('X-Knowledge-CSRF')).toBe(
      session.csrfToken,
    );
    expect(request.request.body.revision).toBe(3);
    request.flush(
      { success: false, error: { code: 'CONFLICT', message: 'test' } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.error()).toBe('knowledge.errors.conflict');
    expect(component.form.controls.title.value).toBe('Moje nowe zmiany');
  });

  it('sends key figures written as one "value | label" line each', () => {
    const component = fixture.componentInstance;
    component.form.controls.facts.setValue('6,6% | Opis testowy\n\n');
    component.save();
    const request = http.expectOne(
      '/api/knowledge/admin/resources/fixture-senior',
    );
    expect(request.request.body.resource.facts).toEqual([
      { value: '6,6%', label: 'Opis testowy' },
    ]);
    request.flush({ success: true, data: resource });
    component.form.controls.facts.setValue('bez opisu');
    component.save();
    http.expectNone('/api/knowledge/admin/resources/fixture-senior');
    expect(component.error()).toBe('knowledge.errors.validation');
  });

  it('rejects untrusted source URLs before making an API request', () => {
    fixture.componentInstance.form.controls.sourceUrl.setValue(
      'https://evil.example/',
    );
    fixture.componentInstance.save();
    http.expectNone('/api/knowledge/admin/resources/fixture-senior');
    expect(fixture.componentInstance.error()).toBe(
      'knowledge.errors.validation',
    );
  });
});

describe('Resource card video', () => {
  it('shows a poster first and loads the YouTube player only after a click', () => {
    TestBed.configureTestingModule({
      imports: [ResourceCardComponent],
      providers,
    });
    const fixture = TestBed.createComponent(ResourceCardComponent);
    fixture.componentRef.setInput('resource', {
      ...resource,
      videoUrl: 'https://www.youtube.com/watch?v=o5TP10ZStNA',
    });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('iframe')).toBeNull();
    element.querySelector<HTMLButtonElement>('.video-poster')?.click();
    fixture.detectChanges();
    expect(element.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/o5TP10ZStNA?autoplay=1',
    );
  });
});

describe('Knowledge topic page', () => {
  function create(area: string): ComponentFixture<KnowledgeTopicComponent> {
    const paramMap = convertToParamMap({ area });
    TestBed.configureTestingModule({
      imports: [KnowledgeTopicComponent],
      providers: [
        ...providers,
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(paramMap), snapshot: { paramMap } },
        },
      ],
    });
    const fixture = TestBed.createComponent(KnowledgeTopicComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('groups one topic into challenge figures and matching innovations', () => {
    const fixture = create('Seniorzy');
    const http = TestBed.inject(HttpTestingController);
    const challenge = {
      ...resource,
      id: 'fixture-challenge',
      kind: 'challenge',
      scope: 'national',
      audiences: [],
      facts: [{ value: '4 obszary', label: 'Opis testowy' }],
    };
    http
      .expectOne(
        (request) =>
          request.url === '/api/knowledge/resources' ||
          request.urlWithParams.startsWith('/api/knowledge/resources?'),
      )
      .flush({
        success: true,
        data: {
          resources: [resource, challenge],
          total: 2,
          page: 1,
          pageSize: 30,
        },
      });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.fact-grid strong')?.textContent).toBe(
      '4 obszary',
    );
    expect(element.querySelectorAll('app-resource-card').length).toBe(1);
    expect(fixture.componentInstance.topic()?.report).toEqual([]);
    http.verify();
  });

  it('does not call the API for an unknown topic', () => {
    const fixture = create('Nieznany temat');
    TestBed.inject(HttpTestingController).verify();
    expect(fixture.componentInstance.error()).toBe('knowledge.topic.unknown');
  });
});

describe('Resource card ROPS preview', () => {
  function create(
    sourceUrl = resource.sourceUrl,
  ): ComponentFixture<ResourceCardComponent> {
    TestBed.configureTestingModule({
      imports: [ResourceCardComponent],
      providers,
    });
    const fixture = TestBed.createComponent(ResourceCardComponent);
    fixture.componentRef.setInput('resource', { ...resource, sourceUrl });
    fixture.detectChanges();
    return fixture;
  }

  it('embeds the resource only on demand and closes it without navigation', () => {
    const fixture = create();
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector<HTMLButtonElement>('.source-toggle');
    expect(element.querySelector('iframe')).toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    toggle?.click();
    fixture.detectChanges();
    const frame = element.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(resource.sourceUrl);
    expect(frame?.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-downloads',
    );
    expect(element.classList.contains('source-expanded')).toBeTrue();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(
      element.querySelector('.source-fallback')?.getAttribute('href'),
    ).toBe(resource.sourceUrl);
    element.querySelector<HTMLButtonElement>('.source-close')?.click();
    fixture.detectChanges();
    expect(element.querySelector('iframe')).toBeNull();
    expect(element.classList.contains('source-expanded')).toBeFalse();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('removes a preview when the displayed resource source changes', () => {
    const fixture = create();
    fixture.componentInstance.toggleSource();
    fixture.detectChanges();
    fixture.componentRef.setInput('resource', {
      ...resource,
      id: 'other',
      sourceUrl: 'https://rops.krakow.pl/',
    });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('iframe')).toBeNull();
    expect(fixture.componentInstance.sourceExpanded()).toBeFalse();
  });

  for (const sourceUrl of [
    'https://evil.example/',
    'https://rops.krakow.pl.evil.example/',
    'https://rops.krakow.pl:8443/',
    'https://user@rops.krakow.pl/',
  ]) {
    it(`does not trust an unsupported iframe source: ${sourceUrl}`, () => {
      const fixture = create(sourceUrl);
      fixture.componentInstance.toggleSource();
      fixture.detectChanges();
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('.source-toggle')).toBeNull();
      expect(element.querySelector('iframe')).toBeNull();
      expect(fixture.componentInstance.sourceEmbedUrl()).toBeNull();
    });
  }
});
