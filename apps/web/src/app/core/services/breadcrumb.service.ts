import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface BreadcrumbItem {
  labelKey: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);
  readonly breadcrumbs = signal<BreadcrumbItem[]>([
    { labelKey: 'nav.home', url: '/' },
  ]);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.updateBreadcrumbs());

    this.updateBreadcrumbs();
  }

  private updateBreadcrumbs(): void {
    let route = this.router.routerState.snapshot.root;
    const items: BreadcrumbItem[] = [{ labelKey: 'nav.home', url: '/' }];

    while (route.firstChild) {
      route = route.firstChild;
      const labelKey = route.data['breadcrumb'];
      const path = route.url.map((segment) => segment.path).join('/');

      if (typeof labelKey === 'string' && labelKey && path) {
        items.push({ labelKey, url: `/${path}` });
      }
    }

    this.breadcrumbs.set(items);
  }
}
