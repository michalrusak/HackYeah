import { BreakpointObserver } from '@angular/cdk/layout';
import { FocusMonitor } from '@angular/cdk/a11y';
import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, map, startWith, switchMap } from 'rxjs';
import { NAV_ITEMS } from '../../constants/app.constants';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-layout',
  host: { '(document:keydown.escape)': 'dismissSidebar()' },
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  readonly theme = inject(ThemeService);
  readonly router = inject(Router);
  readonly navItems = NAV_ITEMS;
  readonly sidebarPinned = signal(false);
  readonly sidebarDismissed = signal(false);
  readonly mobileNavOpen = signal(false);
  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  @ViewChild('mainContent', { read: ElementRef })
  private mainContent?: ElementRef<HTMLElement>;
  private readonly focusMonitor = inject(FocusMonitor);
  private readonly injector = inject(Injector);
  private pendingNavigationFocus = false;

  constructor() {
    const translate = inject(TranslateService);
    const title = inject(Title);
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        map(() => {
          const path = this.router.url.split(/[?#]/)[0];
          return (
            this.navItems.find(
              (item) =>
                item.path !== '/' &&
                (item.path === path || path?.startsWith(`${item.path}/`)),
            )?.labelKey ?? 'nav.home'
          );
        }),
        switchMap((key) =>
          translate.stream([key, 'matchmaking.productName']).pipe(
            map((labels: Record<string, string>) => ({
              page: labels[key],
              app: labels['matchmaking.productName'],
            })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ page, app }) => {
        if (page && app) title.setTitle(`${page} · ${app}`);
        if (this.pendingNavigationFocus) {
          this.pendingNavigationFocus = false;
          afterNextRender(
            () => {
              if (this.mainContent)
                this.focusMonitor.focusVia(this.mainContent, 'program');
            },
            { injector: this.injector },
          );
        }
      });
  }

  onNavigationClick(): void {
    this.mobileNavOpen.set(false);
    this.pendingNavigationFocus = true;
  }

  dismissSidebar(): void {
    if (!this.isMobile()) this.sidebarDismissed.set(true);
  }
}
