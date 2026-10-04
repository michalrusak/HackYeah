import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EditTokenStore } from './edit-token.store';
import { IdeaCreatorApiService } from './idea-creator-api.service';

describe('Idea creator author access', () => {
  let api: IdeaCreatorApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EditTokenStore,
          useValue: {
            ideaToken: (id: string) =>
              id === 'owned' ? 'author-token' : undefined,
          },
        },
      ],
    });
    api = TestBed.inject(IdeaCreatorApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the edit token when simplifying a draft', () => {
    api.plainLanguage('owned', 'author-token').subscribe();
    const request = http.expectOne('/api/ideas/owned/plain-language');
    expect(request.request.headers.get('X-Edit-Token')).toBe('author-token');
    request.flush({ success: true, data: { text: 'Prosty opis.' } });
  });

  it('uses the token belonging to the idea in an assistant conversation', () => {
    api.assistantChat('Pytanie', 'owned').subscribe();
    const request = http.expectOne('/api/assistant/chat');
    expect(request.request.headers.get('X-Edit-Token')).toBe('author-token');
    expect(request.request.body.ideaId).toBe('owned');
    request.flush({
      success: true,
      data: { reply: 'Odpowiedź', followUps: [] },
    });
  });

  it('does not attach another idea token to a public conversation', () => {
    api.assistantChat('Pytanie', 'public').subscribe();
    const request = http.expectOne('/api/assistant/chat');
    expect(request.request.headers.has('X-Edit-Token')).toBeFalse();
    request.flush({
      success: true,
      data: { reply: 'Odpowiedź', followUps: [] },
    });
  });
});
