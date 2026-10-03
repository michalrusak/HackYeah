import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { createApiSuccess } from '@repo/api-contracts';
import { AuthService } from '../../core/services/auth.service';
import { AuthDialogComponent } from './auth-dialog.component';

const user = { id: '12345678-1234-4123-8123-123456789010', login: 'ala.test' };
const storageKey = 'hackyeah.tester-owner-key';

describe('AuthDialogComponent', () => {
  let fixture: ComponentFixture<AuthDialogComponent>;
  let http: HttpTestingController;
  let close: jasmine.Spy;
  let originalKey: string | null;

  beforeEach(async () => {
    originalKey = localStorage.getItem(storageKey);
    localStorage.removeItem(storageKey);
    close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [AuthDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: 'register' },
        { provide: MatDialogRef, useValue: { close, disableClose: false } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuthDialogComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    http.verify();
    if (originalKey) localStorage.setItem(storageKey, originalKey);
    else localStorage.removeItem(storageKey);
  });

  it('focuses the invalid password and announces a short registration password', () => {
    fixture.componentInstance.form.setValue({
      login: 'ala.test',
      password: 'short',
    });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(document.activeElement).toBe(
      root.querySelector('input[formControlName="password"]'),
    );
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'auth.errors.validation',
    );
    http.expectNone('/api/auth/register');
  });

  it('registers with a cookie session and transfers a legacy profile key only once', () => {
    localStorage.setItem(storageKey, 'a'.repeat(64));
    fixture.componentInstance.form.setValue({
      login: 'Ala.Test',
      password: 'a secure password',
    });
    fixture.componentInstance.submit();
    const request = http.expectOne('/api/auth/register');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual({
      login: 'ala.test',
      password: 'a secure password',
      legacyKey: 'a'.repeat(64),
    });
    fixture.componentInstance.submit();
    http.expectNone('/api/auth/register');
    request.flush(createApiSuccess({ user }));
    expect(TestBed.inject(AuthService).user()).toEqual(user);
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(close).toHaveBeenCalledWith('authenticated');
  });

  it('keeps the legacy key and displays a useful error when a login is taken', () => {
    localStorage.setItem(storageKey, 'b'.repeat(64));
    fixture.componentInstance.form.setValue({
      login: 'ala.test',
      password: 'a secure password',
    });
    fixture.componentInstance.submit();
    http
      .expectOne('/api/auth/register')
      .flush(
        { success: false, error: { code: 'CONFLICT', message: 'Taken' } },
        { status: 409, statusText: 'Conflict' },
      );
    expect(fixture.componentInstance.errorKey()).toBe('auth.errors.loginTaken');
    expect(localStorage.getItem(storageKey)).toBe('b'.repeat(64));
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(close).not.toHaveBeenCalled();
  });

  it('uses password manager hints, allows revealing passwords and logs in without a legacy key', () => {
    fixture.componentInstance.switchMode();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const password = root.querySelector<HTMLInputElement>(
      'input[formControlName="password"]',
    );
    expect(password?.autocomplete).toBe('current-password');
    expect(password?.type).toBe('password');
    root.querySelector<HTMLButtonElement>('button[matSuffix]')?.click();
    fixture.detectChanges();
    expect(password?.type).toBe('text');
    fixture.componentInstance.form.setValue({
      login: 'ala.test',
      password: 'correct password',
    });
    fixture.componentInstance.submit();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.body.legacyKey).toBeUndefined();
    expect(request.request.withCredentials).toBeTrue();
    request.flush(createApiSuccess({ user }));
    expect(close).toHaveBeenCalledWith('authenticated');
  });
});
