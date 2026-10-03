import { Component, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NAV_ITEMS } from '../../constants/app.constants';
import { AppHeaderComponent } from '../app-header/app-header.component';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    AppHeaderComponent,
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  readonly navItems = NAV_ITEMS;
  readonly isLoggedIn = signal(false);
  readonly notificationCount = signal(0);
  readonly demoUserName = 'Jan Kowalski';

  private readonly drawer = viewChild.required<MatSidenav>('drawer');

  toggleDrawer(): void {
    this.drawer().toggle();
  }

  closeDrawer(): void {
    this.drawer().close();
  }

  onSearch(query: string): void {
    if (!query) {
      return;
    }

    console.info('[search]', query);
  }

  onLogin(): void {
    this.isLoggedIn.set(true);
    this.notificationCount.set(2);
  }

  onLogout(): void {
    this.isLoggedIn.set(false);
    this.notificationCount.set(0);
  }
}
