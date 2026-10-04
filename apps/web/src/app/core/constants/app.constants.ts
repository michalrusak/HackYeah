import { NavItem } from '../models/nav-item.model';

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.home', path: '/', icon: 'home' },
  { labelKey: 'nav.matchmaking', path: '/matchmaking', icon: 'travel_explore' },
  {
    labelKey: 'nav.adaptation',
    path: '/dostosuj/mobilne-centrum-pomocy',
    icon: 'tune',
  },
  { labelKey: 'knowledge.nav', path: '/zasobnik', icon: 'library_books' },
  {
    labelKey: 'knowledge.admin.nav',
    path: '/zasobnik/admin',
    icon: 'admin_panel_settings',
  },
  { labelKey: 'nav.testers', path: '/tester-innowacji', icon: 'groups' },
  { labelKey: 'nav.ideas', path: '/pomysly', icon: 'lightbulb' },
  { labelKey: 'nav.about', path: '/about', icon: 'info' },
  { labelKey: 'nav.contact', path: '/contact', icon: 'mail' },
  { labelKey: 'nav.rops_contact', path: '/rops-contact', icon: 'forum' },
];
