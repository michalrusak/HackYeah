import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import {
  PilotMatchSchema,
  type TesterProjectDetailData,
} from '@repo/api-contracts';
import { AuthService } from '../../../core/services/auth.service';
import { TestersService } from '../../testers/testers.service';
import { TesterProjectsService } from '../../testers/projects/tester-projects.service';
import { PilotInterestComponent } from './pilot-interest.component';
import { PilotMatchesService } from './pilot-matches.service';

const id = '96c266b4-ae90-472b-ac84-01a163025121';
const match = PilotMatchSchema.parse({
  id,
  title: 'Przykładowy projekt',
  description: 'Opis testów projektu społecznego',
  organizerName: 'Organizator',
  requirements: 'Przeglądarka internetowa',
  location: '',
  mode: 'remote',
  conditions: {
    audiences: ['Seniorzy'],
    needs: ['Dostęp do usług'],
    areas: ['Seniorzy'],
    recruitmentEndsAt: '2099-01-01T00:00:00Z',
    testSchedule: 'Dwa spotkania',
    commitment: 'Dwie godziny i ankieta',
    participants: 'either',
  },
  matchedNeeds: ['Dostęp do usług'],
  matchedAudiences: ['Seniorzy'],
  status: 'testing',
  deploymentApproved: false,
});
const detail: TesterProjectDetailData = {
  project: {
    id,
    title: match.title,
    description: match.description,
    organizerName: match.organizerName,
    requirements: match.requirements,
    location: '',
    mode: 'remote',
    stage: 'prototype',
    status: 'open',
    isOwner: false,
    applicationCount: 0,
    acceptedCount: 0,
    feedbackCount: 0,
    averageRating: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  myApplication: null,
  myFeedback: null,
  feedback: [],
};
const applied: TesterProjectDetailData = {
  ...detail,
  myApplication: {
    id: '06a98bc5-5551-42f2-b08a-d478e3362df5',
    projectId: id,
    message: 'Chcę pomóc',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

describe('PilotInterestComponent', () => {
  let fixture: ComponentFixture<PilotInterestComponent>;
  const auth = { user: signal<object | null>({ id: 'tester' }) };
  const projects = { detail: jasmine.createSpy('detail') };
  const pilots = { apply: jasmine.createSpy('apply') };
  const testers = { myProfile: jasmine.createSpy('myProfile') };
  const dialogs = { open: jasmine.createSpy('open') };
  beforeEach(async () => {
    auth.user.set({ id: 'tester' });
    for (const spy of [
      projects.detail,
      pilots.apply,
      testers.myProfile,
      dialogs.open,
    ])
      spy.calls.reset();
    projects.detail.and.returnValue(of(detail));
    pilots.apply.and.returnValue(of(applied));
    testers.myProfile.and.returnValue(of({ profile: { id: 'profile' } }));
    dialogs.open.and.returnValue({ afterClosed: () => of(undefined) });
    await TestBed.configureTestingModule({
      imports: [PilotInterestComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: AuthService, useValue: auth },
        { provide: TesterProjectsService, useValue: projects },
        { provide: PilotMatchesService, useValue: pilots },
        { provide: TestersService, useValue: testers },
        { provide: MatDialog, useValue: dialogs },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PilotInterestComponent);
    fixture.componentRef.setInput('match', match);
    fixture.detectChanges();
    fixture.componentInstance.message.setValue('Chcę pomóc');
  });
  it('handles a real form submit without navigating away from the results', () => {
    auth.user.set(null);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    root.querySelector('form')?.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(dialogs.open).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.message.value).toBe('Chcę pomóc');
  });

  it('keeps the draft when login is cancelled and does not send', () => {
    auth.user.set(null);
    fixture.componentInstance.submit();
    expect(dialogs.open).toHaveBeenCalledTimes(1);
    expect(pilots.apply).not.toHaveBeenCalled();
    expect(fixture.componentInstance.message.value).toBe('Chcę pomóc');
    expect(fixture.componentInstance.busy()).toBeFalse();
  });
  it('keeps the draft when profile creation is cancelled', () => {
    testers.myProfile.and.returnValue(of({ profile: null }));
    fixture.componentInstance.submit();
    expect(dialogs.open).toHaveBeenCalledTimes(1);
    expect(pilots.apply).not.toHaveBeenCalled();
    expect(fixture.componentInstance.message.value).toBe('Chcę pomóc');
  });
  it('prevents double submission and shows pending status after success', () => {
    const response = new Subject<TesterProjectDetailData>();
    pilots.apply.and.returnValue(response);
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    expect(pilots.apply).toHaveBeenCalledOnceWith(id, 'Chcę pomóc');
    response.next(applied);
    response.complete();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('projects.applicationStatus.pending');
    expect(root.querySelector('form')).toBeNull();
    expect(fixture.componentInstance.busy()).toBeFalse();
  });
  it('does not resend an application already present on the server', () => {
    projects.detail.and.returnValue(of(applied));
    fixture.componentInstance.submit();
    expect(pilots.apply).not.toHaveBeenCalled();
    expect(fixture.componentInstance.detail()?.myApplication?.status).toBe(
      'pending',
    );
  });
  it('stops submission when recruitment becomes unavailable', () => {
    pilots.apply.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.componentInstance.unavailable()).toBeTrue();
    expect(fixture.componentInstance.message.value).toBe('Chcę pomóc');
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('pilots.unavailable');
  });
});
