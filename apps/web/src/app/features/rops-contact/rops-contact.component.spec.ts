import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import type { ContactConversation } from '@repo/api-contracts';
import { ContactDraftService } from '../../core/services/contact-draft.service';
import { RopsContactComponent } from './rops-contact.component';

const conversation: ContactConversation = {
  id: 'conversation-1',
  subject: 'Fikcyjne pytanie',
  category: 'MENTOR',
  status: 'ANSWERED',
  firstName: 'Anna',
  lastName: 'Testowa',
  organization: null,
  area: null,
  expertName: null,
  createdAt: '2026-10-04T08:00:00.000Z',
  updatedAt: '2026-10-04T09:00:00.000Z',
};
const user = { id: '7f1f5e0e-6a52-4d53-9a3a-0d6f0f6f3a11', login: 'anna' };
const ok = (data: unknown) => ({ success: true, data });

describe('RopsContactComponent', () => {
  let fixture: ComponentFixture<RopsContactComponent>;
  let http: HttpTestingController;
  const text = (): string => fixture.nativeElement.textContent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RopsContactComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('asks a guest to log in and requests no conversations', () => {
    fixture = TestBed.createComponent(RopsContactComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/me').flush(ok({ user: null }));
    fixture.detectChanges();
    http.expectNone('/api/contact/conversations');
    expect(text()).toContain('rops-contact.loginTitle');
    expect(text()).not.toContain('rops-contact.simulate_role');
  });

  it('shows own conversations and sends a reply with the session cookie', () => {
    fixture = TestBed.createComponent(RopsContactComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/me').flush(ok({ user }));
    const list = http.expectOne('/api/contact/conversations');
    expect(list.request.withCredentials).toBeTrue();
    expect(list.request.headers.has('user-role')).toBeFalse();
    list.flush(ok({ items: [conversation] }));
    fixture.detectChanges();
    expect(text()).toContain('Fikcyjne pytanie');

    const component = fixture.componentInstance;
    component.open(conversation);
    const thread = {
      conversation,
      messages: [
        {
          id: 'm1',
          author: 'ROPS',
          content: 'Odpowiedź ROPS',
          createdAt: '2026-10-04T09:00:00.000Z',
        },
      ],
    };
    http
      .expectOne('/api/contact/conversations/conversation-1')
      .flush(ok(thread));
    fixture.detectChanges();
    expect(text()).toContain('Odpowiedź ROPS');

    component.reply.setValue('  Dziękuję  ');
    component.send();
    const sent = http.expectOne(
      '/api/contact/conversations/conversation-1/messages',
    );
    expect(sent.request.body).toEqual({ content: 'Dziękuję' });
    expect(sent.request.withCredentials).toBeTrue();
    sent.flush(
      ok({
        ...thread,
        conversation: { ...conversation, status: 'AWAITING_ROPS' },
      }),
    );
    expect(component.conversations()[0]?.status).toBe('AWAITING_ROPS');
    expect(component.reply.value).toBe('');
  });

  it('opens a prefilled new conversation from a draft', () => {
    TestBed.inject(ContactDraftService).set('Temat szkicu', 'Treść szkicu');
    fixture = TestBed.createComponent(RopsContactComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/me').flush(ok({ user }));
    http.expectOne('/api/contact/conversations').flush(ok({ items: [] }));
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.creating()).toBeTrue();
    expect(component.form.controls.subject.value).toBe('Temat szkicu');

    component.create();
    http.expectNone('/api/contact/conversations');
    component.form.patchValue({ firstName: 'Anna', lastName: 'Testowa' });
    component.create();
    const created = http.expectOne('/api/contact/conversations');
    expect(created.request.body).toEqual({
      firstName: 'Anna',
      lastName: 'Testowa',
      organization: '',
      category: 'QUESTION',
      subject: 'Temat szkicu',
      initialMessage: 'Treść szkicu',
    });
    created.flush(ok({ conversation, messages: [] }));
    expect(component.creating()).toBeFalse();
  });
});
