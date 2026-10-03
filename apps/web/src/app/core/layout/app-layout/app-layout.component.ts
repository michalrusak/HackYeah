import { FocusMonitor } from '@angular/cdk/a11y';
import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
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

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  readonly router = inject(Router);
  readonly navItems = NAV_ITEMS;
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
          translate.stream([key, 'app.name']).pipe(
            map((labels: Record<string, string>) => ({
              page: labels[key],
              app: labels['app.name'],
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
    this.pendingNavigationFocus = true;
  }
}
