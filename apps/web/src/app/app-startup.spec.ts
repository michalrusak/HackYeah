import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { createApiSuccess } from '@repo/api-contracts';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';
import { BreadcrumbService } from './core/services/breadcrumb.service';

describe('Application startup', () => {
  it('loads configuration and renders the matchmaking route', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [...appConfig.providers, provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const init = TestBed.inject(ApplicationInitStatus);
    http.expectOne('/api-config.json').flush({ apiUrl: '/api' });
    TestBed.inject(TranslateService);
    http.expectOne('/i18n/pl.json').flush({
      home: { cta: 'Znajdź rozwiązanie' },
      matchmaking: {
        chat: { title: 'Co chcesz zmienić w swojej społeczności?' },
      },
    });
    await init.donePromise;
    http.expectOne('/api/demo').flush(
      createApiSuccess({
        adminPassword: null,
        accounts: [],
        expertGrant: null,
      }),
    );
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/matchmaking');
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('textarea')).not.toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain(
      'Co chcesz zmienić w swojej społeczności?',
    );
    expect(TestBed.inject(TranslateService).instant('home.cta')).toBe(
      'Znajdź rozwiązanie',
    );
    expect(TestBed.inject(BreadcrumbService).breadcrumbs()).toEqual([
      { labelKey: 'nav.home', url: '/' },
      { labelKey: 'nav.matchmaking', url: '/matchmaking' },
    ]);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/matchmaking');
    expect(element.querySelector('textarea')).not.toBeNull();
    expect(element.querySelector('app-home')).toBeNull();
    expect(element.querySelector('input[type="search"]')).toBeNull();
    expect(element.textContent).not.toContain('Hello World');
    expect(element.querySelector('app-header')).toBeNull();
    expect(TestBed.inject(BreadcrumbService).breadcrumbs()).toEqual([
      { labelKey: 'nav.home', url: '/' },
      { labelKey: 'nav.matchmaking', url: '/matchmaking' },
    ]);
    http.verify();
  });
});
