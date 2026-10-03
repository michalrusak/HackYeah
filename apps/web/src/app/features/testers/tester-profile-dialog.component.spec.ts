import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { createApiSuccess, type TesterProfile } from '@repo/api-contracts';
import { TesterProfileDialogComponent } from './tester-profile-dialog.component';

const profile: TesterProfile = {
  id: '12345678-1234-4123-8123-123456789012',
  displayName: 'Ala',
  city: 'Kraków',
  bio: 'Chętnie testuję społeczne aplikacje.',
  skills: ['Grafika'],
  resources: ['Komputer'],
  interests: [],
  accessibilityNeeds: '',
  availability: 'remote',
  consent: true,
  isActive: true,
  isDemo: false,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};

describe('TesterProfileDialogComponent', () => {
  let fixture: ComponentFixture<TesterProfileDialogComponent>;
  let http: HttpTestingController;
  let close: jasmine.Spy;
  let dialog: { close: jasmine.Spy; disableClose: boolean };

  async function setup(existing: TesterProfile | null = null): Promise<void> {
    close = jasmine.createSpy('close');
    dialog = { close, disableClose: false };
    await TestBed.configureTestingModule({
      imports: [TesterProfileDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: existing },
        { provide: MatDialogRef, useValue: dialog },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TesterProfileDialogComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  afterEach(() => http?.verify());

  it('keeps a screen-reader name on the Material dialog close button', async () => {
    await setup();
    const root: HTMLElement = fixture.nativeElement;
    expect(
      root
        .querySelector('button[mat-dialog-close]')
        ?.getAttribute('aria-label'),
    ).toBe('testers.close');
  });

  it('validates mandatory fields and has no consent or visibility controls', async () => {
    await setup();
    const component = fixture.componentInstance;
    component.form.patchValue({
      displayName: '',
      city: 'Kraków',
      bio: 'Chętnie testuję społeczne aplikacje.',
    });
    component.save();
    expect(component.form.controls.displayName.invalid).toBeTrue();
    http.expectNone('/api/testers/profile/me');
    component.form.patchValue({ displayName: '   ' });
    component.save();
    expect(component.form.controls.displayName.invalid).toBeTrue();
    http.expectNone('/api/testers/profile/me');
  });

  it('creates a profile using cookies and omits removed consent and sharing controls', async () => {
    await setup();
    const component = fixture.componentInstance;
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('input[readonly]')).toBeNull();
    component.form.patchValue({
      displayName: 'Ala',
      city: 'Kraków',
      bio: profile.bio,
      skills: 'Grafika, Grafika, Testowanie',
      resources: 'Komputer',
    });
    component.save();
    const request = http.expectOne('/api/testers/profile/me');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.skills).toEqual(['Grafika', 'Testowanie']);
    expect(request.request.body.consent).toBeUndefined();
    expect(request.request.withCredentials).toBeTrue();
    component.save();
    http.expectNone('/api/testers/profile/me');
    request.flush(createApiSuccess({ profile }));
    expect(close).toHaveBeenCalledWith('saved');
  });

  it('populates and edits an existing profile without changing visibility', async () => {
    await setup(profile);
    const component = fixture.componentInstance;
    expect(component.form.controls.displayName.value).toBe('Ala');
    expect(component.form.controls.skills.value).toBe('Grafika');
    component.form.patchValue({ city: 'Warszawa' });
    component.save();
    const request = http.expectOne('/api/testers/profile/me');
    expect(request.request.body.city).toBe('Warszawa');
    expect(request.request.body.isActive).toBeUndefined();
    request.flush(
      createApiSuccess({
        profile: { ...profile, city: 'Warszawa' },
      }),
    );
    expect(close).toHaveBeenCalledWith('saved');
  });

  it('keeps the form open and editable after a network failure', async () => {
    await setup(profile);
    fixture.componentInstance.save();
    expect(dialog.disableClose).toBeTrue();
    http.expectOne('/api/testers/profile/me').error(new ProgressEvent('error'));
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(dialog.disableClose).toBeFalse();
    expect(fixture.componentInstance.errorKey()).toBe('testers.errors.generic');
    expect(close).not.toHaveBeenCalled();
  });

  it('moves keyboard focus to the first invalid field and announces validation', async () => {
    await setup();
    fixture.componentInstance.save();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(document.activeElement).toBe(
      root.querySelector('input[formControlName="displayName"]'),
    );
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'testers.profile.validation',
    );
    expect(
      root.querySelector('mat-checkbox, mat-slide-toggle, .access-panel'),
    ).toBeNull();
    http.expectNone('/api/testers/profile/me');
  });
});
