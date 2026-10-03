import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import {
  createApiSuccess,
  type TesterProject,
  type TesterProjectDetailData,
} from '@repo/api-contracts';
import { AuthService } from '../../../core/services/auth.service';
import { ProjectDetailDialogComponent } from './project-detail-dialog.component';
import { ProjectFormDialogComponent } from './project-form-dialog.component';
import { TesterProjectsComponent } from './tester-projects.component';

const project: TesterProject = {
  id: '12345678-1234-4123-8123-123456789011',
  organizerName: 'Fundacja Sąsiedzi',
  title: 'Test pomysłu na integrację',
  description: 'Spotkania sąsiedzkie łączące pokolenia w naszej okolicy.',
  requirements: 'Osoby chętne do wspólnych spotkań',
  location: 'Kraków',
  mode: 'hybrid',
  stage: 'prototype',
  status: 'open',
  isOwner: false,
  applicationCount: 0,
  acceptedCount: 0,
  feedbackCount: 0,
  averageRating: null,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};
const detail: TesterProjectDetailData = {
  project,
  myApplication: null,
  myFeedback: null,
  feedback: [],
};

describe('Tester project forms', () => {
  let http: HttpTestingController;
  let close: jasmine.Spy;
  beforeEach(async () => {
    close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [ProjectFormDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { requirements: 'Szukam mocnego komputera' },
        },
        { provide: MatDialogRef, useValue: { close, disableClose: false } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
  });

  it('keeps search requirements and the draft after cancelling login', async () => {
    const fixture = TestBed.createComponent(ProjectFormDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue(project);
    fixture.componentInstance.form.controls.requirements.setValue(
      'Szukam mocnego komputera',
    );
    const draft = fixture.componentInstance.form.getRawValue();
    fixture.componentInstance.save();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    TestBed.inject(MatDialog).closeAll();
    await fixture.whenStable();
    expect(fixture.componentInstance.form.getRawValue()).toEqual(draft);
    http.expectNone('/api/testers/projects');
    expect(close).not.toHaveBeenCalled();
  });

  it('validates project data and focuses the first invalid field', () => {
    const fixture = TestBed.createComponent(ProjectFormDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.save();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(document.activeElement).toBe(
      root.querySelector('[formControlName="organizerName"]'),
    );
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'projects.validation',
    );
    http.expectNone('/api/testers/projects');
  });

  it('publishes using the account cookie and a separate public organizer name', () => {
    TestBed.inject(AuthService).refresh().subscribe();
    http
      .expectOne('/api/auth/me')
      .flush(
        createApiSuccess({ user: { id: project.id, login: 'private-login' } }),
      );
    const fixture = TestBed.createComponent(ProjectFormDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue(project);
    fixture.componentInstance.save();
    const request = http.expectOne('/api/testers/projects');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body.organizerName).toBe('Fundacja Sąsiedzi');
    expect(request.request.body.login).toBeUndefined();
    expect(request.request.body.isOwner).toBeUndefined();
    request.flush(createApiSuccess(detail));
    expect(close).toHaveBeenCalledWith(project);
  });
});

describe('Tester project participation', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDetailDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: project.id },
        {
          provide: MatDialogRef,
          useValue: { close: jasmine.createSpy(), disableClose: false },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('requires an explicit rating and saves feedback only for an accepted application', () => {
    const fixture = TestBed.createComponent(ProjectDetailDialogComponent);
    const accepted = {
      ...detail,
      myApplication: {
        id: '12345678-1234-4123-8123-123456789012',
        projectId: project.id,
        message: '',
        status: 'accepted',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    };
    http
      .expectOne(`/api/testers/projects/${project.id}`)
      .flush(createApiSuccess(accepted));
    fixture.detectChanges();
    expect(
      fixture.componentInstance.feedbackForm.controls.rating.value,
    ).toBeNull();
    fixture.componentInstance.saveFeedback();
    http.expectNone(`/api/testers/projects/${project.id}/feedback/me`);
    fixture.componentInstance.feedbackForm.setValue({
      rating: 4,
      review: 'Bardzo przydatne rozwiązanie dla sąsiadów.',
      improvement: 'Więcej terminów spotkań.',
    });
    fixture.componentInstance.saveFeedback();
    const request = http.expectOne(
      `/api/testers/projects/${project.id}/feedback/me`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body.rating).toBe(4);
    request.flush(createApiSuccess(accepted));
    expect(fixture.componentInstance.announcement()).toBe(
      'projects.feedbackSaved',
    );
  });

  it('never offers participant withdrawal for a declined application', () => {
    const fixture = TestBed.createComponent(ProjectDetailDialogComponent);
    http.expectOne(`/api/testers/projects/${project.id}`).flush(
      createApiSuccess({
        ...detail,
        myApplication: {
          id: '12345678-1234-4123-8123-123456789012',
          projectId: project.id,
          message: '',
          status: 'declined',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      }),
    );
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).not.toContain('projects.withdraw');
    expect(root.querySelector('form')).toBeNull();
  });
});

describe('Tester project tab state', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TesterProjectsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).refresh().subscribe();
    http
      .expectOne('/api/auth/me')
      .flush(createApiSuccess({ user: { id: project.id, login: 'tester' } }));
  });
  afterEach(() => http.verify());

  it('cancels activity loading and clears private data and spinner on logout', () => {
    const fixture = TestBed.createComponent(TesterProjectsComponent);
    fixture.componentRef.setInput('mode', 'activity');
    fixture.detectChanges();
    const pending = http.expectOne('/api/testers/activity');
    expect(fixture.componentInstance.loading()).toBeTrue();
    TestBed.inject(AuthService).logout().subscribe();
    http
      .expectOne('/api/auth/logout')
      .flush(createApiSuccess({ loggedOut: true }));
    fixture.detectChanges();
    expect(pending.cancelled).toBeTrue();
    expect(fixture.componentInstance.activity()).toBeNull();
    expect(fixture.componentInstance.loading()).toBeFalse();
    http.expectNone('/api/testers/activity');
  });

  it('reloads a previously visited activity tab when it becomes active again', () => {
    const fixture = TestBed.createComponent(TesterProjectsComponent);
    fixture.componentRef.setInput('mode', 'activity');
    fixture.detectChanges();
    http
      .expectOne('/api/testers/activity')
      .flush(
        createApiSuccess({ projects: [], applications: [], feedback: [] }),
      );
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    http.expectNone('/api/testers/activity');
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    http
      .expectOne('/api/testers/activity')
      .flush(
        createApiSuccess({
          projects: [project],
          applications: [],
          feedback: [],
        }),
      );
    expect(fixture.componentInstance.activity()?.projects[0]?.id).toBe(
      project.id,
    );
  });
});
