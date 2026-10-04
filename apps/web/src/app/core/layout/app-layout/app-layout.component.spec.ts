import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AppLayoutComponent } from './app-layout.component';

describe('Sidebar interactions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService(),
      ],
    }).compileComponents();
  });

  it('starts unpinned and collapses immediately when the pin button is released', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const pin = element.querySelector<HTMLButtonElement>(
      '.sidebar-footer button',
    );
    expect(pin?.getAttribute('aria-pressed')).toBe('false');
    pin?.click();
    fixture.detectChanges();
    expect(element.querySelector('.sidebar-pinned')).not.toBeNull();
    pin?.focus();
    pin?.click();
    fixture.detectChanges();
    expect(element.querySelector('.sidebar-pinned')).toBeNull();
    expect(element.querySelector('.sidebar-dismissed')).not.toBeNull();
    expect(pin?.getAttribute('aria-pressed')).toBe('false');
  });

  it('collapses after the pointer leaves even when a sidebar button still has focus', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.sidebar-footer button')?.focus();
    element
      .querySelector('#app-sidebar')
      ?.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(element.querySelector('.sidebar-dismissed')).not.toBeNull();
    element
      .querySelector('#app-sidebar')
      ?.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(element.querySelector('.sidebar-dismissed')).toBeNull();
  });

  it('marks only the most specific menu entry as the current page', async () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const element: HTMLElement = fixture.nativeElement;
    const current = (): (string | null)[] =>
      Array.from(element.querySelectorAll('.nav-link.active')).map((link) =>
        link.getAttribute('href'),
      );
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: '**', children: [] }]);

    await router.navigateByUrl('/zasobnik/admin');
    fixture.detectChanges();
    expect(current()).toEqual(['/zasobnik/admin']);
    expect(
      element.querySelector('.nav-link.active')?.getAttribute('aria-current'),
    ).toBe('page');

    await router.navigateByUrl('/zasobnik/temat/Seniorzy?kind=report');
    fixture.detectChanges();
    expect(current()).toEqual(['/zasobnik']);
  });

  it('Escape closes a pinned sidebar', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.sidebar-footer button')?.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('.sidebar-pinned')).toBeNull();
    expect(element.querySelector('.sidebar-dismissed')).not.toBeNull();
  });
});
