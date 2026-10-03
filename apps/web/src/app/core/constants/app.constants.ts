import { NavItem } from '../models/nav-item.model';

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.home', path: '/', icon: 'home' },
  { labelKey: 'nav.matchmaking', path: '/matchmaking', icon: 'travel_explore' },
  { labelKey: 'nav.testers', path: '/tester-innowacji', icon: 'groups' },
  { labelKey: 'nav.ideas', path: '/pomysly', icon: 'lightbulb' },
  { labelKey: 'nav.calls', path: '/nabory', icon: 'description' },
  { labelKey: 'nav.materials', path: '/materialy', icon: 'menu_book' },
  { labelKey: 'nav.about', path: '/about', icon: 'info' },
  { labelKey: 'nav.contact', path: '/contact', icon: 'mail' },
  { labelKey: 'nav.rops_contact', path: '/rops-contact', icon: 'forum' },
];
