import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import type { ExpertConversation } from '@repo/api-contracts';
import { ExpertAdminComponent } from '../knowledge/expert-admin.component';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ExpertPanelComponent } from './expert-panel.component';

const conversation: ExpertConversation = {
  id: 'conversation-1',
  subject: 'Fikcyjna prośba o mentora',
  category: 'MENTOR',
  status: 'AWAITING_ROPS',
  firstName: 'Anna',
  lastName: 'Testowa',
  organization: null,
  area: 'Seniorzy',
  expertName: null,
  mine: false,
  createdAt: '2026-10-04T08:00:00.000Z',
  updatedAt: '2026-10-04T09:00:00.000Z',
};
const account = { id: '7f1f5e0e-6a52-4d53-9a3a-0d6f0f6f3a11', login: 'maria' };
const expert = { name: 'Maria Senioralna', areas: ['Seniorzy'] };
const ok = (data: unknown) => ({ success: true, data });
const providers = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideNoopAnimations(),
  provideRouter([]),
  provideTranslateService(),
];

describe('ExpertPanelComponent', () => {
  let fixture: ComponentFixture<ExpertPanelComponent>;
  let http: HttpTestingController;
  const text = (): string => fixture.nativeElement.textContent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpertPanelComponent],
      providers,
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ExpertPanelComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('explains that the role comes from ROPS and loads nothing for a regular account', () => {
    http.expectOne('/api/auth/me').flush(ok({ user: account }));
    fixture.detectChanges();
    http.expectNone('/api/experts/conversations');
    expect(text()).toContain('expert.notExpertTitle');
  });

  it('shows cases from the expert areas, takes one and signs the reply', () => {
    http.expectOne('/api/auth/me').flush(ok({ user: { ...account, expert } }));
    const queue = http.expectOne('/api/experts/conversations');
    expect(queue.request.withCredentials).toBeTrue();
    queue.flush(ok({ items: [conversation], attention: 1 }));
    http.expectOne('/api/experts/ideas').flush(ok({ items: [] }));
    fixture.detectChanges();
    expect(text()).toContain('Fikcyjna prośba o mentora');

    const component = fixture.componentInstance;
    const thread = {
      conversation,
      messages: [
        {
          id: 'm1',
          author: 'USER',
          content: 'Potrzebuję wsparcia.',
          createdAt: '2026-10-04T08:00:00.000Z',
        },
      ],
    };
    component.openThread(conversation.id);
    http
      .expectOne('/api/experts/conversations/conversation-1')
      .flush(ok(thread));
    fixture.detectChanges();
    expect(text()).toContain('expert.conversations.take');

    component.reply();
    http.expectNone('/api/experts/conversations/conversation-1/messages');
    expect(component.errorKey()).toBe('expert.messageRequired');

    component.message.setValue('  Pomogę.  ');
    component.reply();
    const sent = http.expectOne(
      '/api/experts/conversations/conversation-1/messages',
    );
    expect(sent.request.body).toEqual({ content: 'Pomogę.' });
    const mine = {
      ...conversation,
      status: 'ANSWERED',
      mine: true,
      expertName: expert.name,
    };
    sent.flush(
      ok({
        conversation: mine,
        messages: [
          ...thread.messages,
          {
            id: 'm2',
            author: 'EXPERT',
            authorName: expert.name,
            content: 'Pomogę.',
            createdAt: '2026-10-04T09:00:00.000Z',
          },
        ],
      }),
    );
    http
      .expectOne('/api/experts/conversations')
      .flush(ok({ items: [mine], attention: 0 }));
    http.expectOne('/api/experts/ideas').flush(ok({ items: [] }));
    fixture.detectChanges();
    expect(component.queue()?.attention).toBe(0);
    expect(component.message.value).toBe('');
    expect(text()).toContain('Maria Senioralna');
    expect(text()).toContain('expert.conversations.release');
  });
});

describe('ExpertAdminComponent', () => {
  it('grants the role only with a login, a name and at least one area', () => {
    TestBed.configureTestingModule({
      imports: [ExpertAdminComponent],
      providers,
    });
    TestBed.inject(KnowledgeService).session.set({
      csrfToken: 'a'.repeat(64),
      expiresAt: '2026-10-04T23:00:00.000Z',
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ExpertAdminComponent);
    fixture.detectChanges();
    http.expectOne('/api/knowledge/admin/experts').flush(ok({ experts: [] }));
    const component = fixture.componentInstance;

    component.form.patchValue({ login: 'maria', name: 'Maria Senioralna' });
    component.grant();
    http.expectNone('/api/knowledge/admin/experts');
    expect(component.errorKey()).toBe('knowledge.admin.experts.invalid');

    component.form.patchValue({ areas: ['Seniorzy'] });
    component.grant();
    const request = http.expectOne('/api/knowledge/admin/experts');
    expect(request.request.headers.get('X-Knowledge-CSRF')).toBe(
      'a'.repeat(64),
    );
    expect(request.request.body).toEqual({
      login: 'maria',
      name: 'Maria Senioralna',
      areas: ['Seniorzy'],
    });
    request.flush(
      { success: false, error: { code: 'NOT_FOUND', message: 'test' } },
      { status: 404, statusText: 'Not Found' },
    );
    expect(component.errorKey()).toBe('knowledge.admin.experts.noAccount');
    expect(component.form.controls.login.value).toBe('maria');
    http.verify();
  });
});
