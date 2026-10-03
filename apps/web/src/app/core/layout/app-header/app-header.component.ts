import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_NAME, NAV_ITEMS } from '../../constants/app.constants';
import { NavItem } from '../../models/nav-item.model';

@Component({
  selector: 'app-header',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  readonly appName = APP_NAME;
  readonly navItems = input<NavItem[]>(NAV_ITEMS);
  readonly isLoggedIn = input(false);
  readonly notificationCount = input(0);
  readonly userName = input('Użytkownik');

  readonly menuToggle = output<void>();
  readonly search = output<string>();
  readonly login = output<void>();
  readonly logout = output<void>();

  searchQuery = '';

  onSearchSubmit(): void {
    this.search.emit(this.searchQuery.trim());
  }
}
