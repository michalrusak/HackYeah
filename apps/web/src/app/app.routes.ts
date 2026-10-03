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
        path: 'pomysly',
        loadChildren: () =>
          import('./features/idea-creator/idea-creator.routes').then(
            (m) => m.ideaRoutes,
          ),
        data: { breadcrumb: 'nav.ideas' },
      },
      {
        path: 'nabory',
        loadChildren: () =>
          import('./features/idea-creator/idea-creator.routes').then(
            (m) => m.callRoutes,
          ),
        data: { breadcrumb: 'nav.calls' },
      },
      {
        path: 'materialy',
        loadComponent: () =>
          import(
            './features/idea-creator/pages/materials/materials.component'
          ).then((m) => m.MaterialsComponent),
        data: { breadcrumb: 'nav.materials' },
      },
      {
        path: 'about',
        component: AboutComponent,
        data: { breadcrumb: 'nav.about' },
      },
      {
        path: 'rops-contact',
        loadComponent: () =>
          import('./features/rops-contact/rops-contact.component').then(
            (m) => m.RopsContactComponent,
          ),
        data: { breadcrumb: 'nav.rops_contact' },
      },
      {
        path: 'contact',
        component: ContactComponent,
        data: { breadcrumb: 'nav.contact' },
      },
    ],
  },
];
