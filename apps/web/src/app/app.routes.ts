import { Routes } from '@angular/router';
import { AppLayoutComponent } from './core/layout/app-layout/app-layout.component';
import { AboutComponent } from './pages/about/about.component';
import { ContactComponent } from './pages/contact/contact.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: '', redirectTo: 'matchmaking', pathMatch: 'full' },
      {
        path: 'matchmaking',
        loadComponent: () =>
          import('./features/matchmaking/matchmaking.component').then(
            (m) => m.MatchmakingComponent,
          ),
        data: { breadcrumb: 'nav.matchmaking' },
      },
      {
        path: 'tester-innowacji',
        loadComponent: () =>
          import('./features/testers/testers.component').then(
            (m) => m.TestersComponent,
          ),
        data: { breadcrumb: 'nav.testers' },
      },
      {
        path: 'about',
        component: AboutComponent,
        data: { breadcrumb: 'nav.about' },
      },
      {
        path: 'contact',
        component: ContactComponent,
        data: { breadcrumb: 'nav.contact' },
      },
    ],
  },
];
