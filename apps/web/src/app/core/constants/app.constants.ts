import { NavItem } from '../models/nav-item.model';

export const APP_NAME = 'HackYeah';

export const NAV_ITEMS: NavItem[] = [
  { label: 'Start', path: '/', icon: 'home' },
  { label: 'O projekcie', path: '/about', icon: 'info' },
  { label: 'Kontakt', path: '/contact', icon: 'mail' },
];
