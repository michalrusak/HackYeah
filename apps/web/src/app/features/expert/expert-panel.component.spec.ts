import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import type {
  ExpertConversation,
  ExpertGrantRequest,
} from '@repo/api-contracts';
import { DemoService } from '../../core/services/demo.service';
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
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('requires an expert login on the page and lets the expert log out', () => {
    http.expectOne('/api/auth/me').flush(ok({ user: null }));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    expect(text()).toContain('expert.loginTitle');
    http.expectNone('/api/experts/conversations');

    component.form.setValue({ login: 'Maria', password: 'a secure password' });
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    const login = http.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({
      login: 'maria',
      password: 'a secure password',
    });
    login.flush(ok({ user: { ...account, expert } }));
    http
      .expectOne('/api/experts/conversations')
      .flush(ok({ items: [conversation], attention: 1 }));
    http.expectOne('/api/experts/ideas').flush(ok({ items: [] }));
    fixture.detectChanges();
    expect(root.querySelector('form')).toBeNull();
    expect(text()).toContain('Fikcyjna prośba o mentora');
    expect(component.form.getRawValue()).toEqual({ login: '', password: '' });

    component.logout();
    http.expectOne('/api/auth/logout').flush(ok({ loggedOut: true }));
    fixture.detectChanges();
    expect(component.queue()).toBeNull();
    expect(text()).toContain('expert.loginTitle');
    expect(text()).not.toContain('Fikcyjna prośba o mentora');
    expect(root.querySelector('.mat-form-field-invalid')).toBeNull();
  });

  it('prefills the demo expert account and reports a wrong password', () => {
    TestBed.inject(DemoService).load();
    http.expectOne('/api/demo').flush(
      ok({
        adminPassword: null,
        accounts: [
          { login: 'demo-tester', password: 'demo password 1', role: 'tester' },
          {
            login: 'demo-ekspert',
            password: 'demo password 1',
            role: 'expert',
          },
        ],
        expertGrant: null,
      }),
    );
    http.expectOne('/api/auth/me').flush(ok({ user: null }));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.demo-note')).not.toBeNull();
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      login: 'demo-ekspert',
      password: 'demo password 1',
    });

    fixture.componentInstance.login();
    http
      .expectOne('/api/auth/login')
      .flush(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'test' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();
    expect(text()).toContain('auth.errors.invalidCredentials');
    expect(fixture.componentInstance.busy()).toBeFalse();
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

  it('prefills the grant form with demo data for the jury', () => {
    TestBed.configureTestingModule({
      imports: [ExpertAdminComponent],
      providers,
    });
    const http = TestBed.inject(HttpTestingController);
    const expertGrant: ExpertGrantRequest = {
      login: 'demo-organizator',
      name: 'Drugi ekspert demonstracyjny',
      areas: ['Seniorzy'],
    };
    TestBed.inject(DemoService).load();
    http
      .expectOne('/api/demo')
      .flush(ok({ adminPassword: null, accounts: [], expertGrant }));
    const fixture = TestBed.createComponent(ExpertAdminComponent);
    fixture.detectChanges();
    http.expectOne('/api/knowledge/admin/experts').flush(ok({ experts: [] }));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.form.getRawValue()).toEqual(expertGrant);
    expect(root.querySelector('.demo-note')).not.toBeNull();
    http.verify();
  });

  it('leaves an empty form without error marks after saving an expert', () => {
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
    const root: HTMLElement = fixture.nativeElement;

    fixture.componentInstance.form.setValue({
      login: 'maria',
      name: 'Maria Senioralna',
      areas: ['Seniorzy'],
    });
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectOne('/api/knowledge/admin/experts').flush(ok({ experts: [] }));
    fixture.detectChanges();

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      login: '',
      name: '',
      areas: [],
    });
    expect(root.querySelector('.mat-form-field-invalid')).toBeNull();
    expect(fixture.componentInstance.noticeKey()).toBe(
      'knowledge.admin.experts.done.grant',
    );
    http.verify();
  });
});
