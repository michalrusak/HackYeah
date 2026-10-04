import { Routes } from '@angular/router';
import { AppLayoutComponent } from './core/layout/app-layout/app-layout.component';

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
        path: 'dostosuj/mobilne-centrum-pomocy',
        loadComponent: () =>
          import('./features/adaptation/adaptation.component').then(
            (m) => m.AdaptationComponent,
          ),
        data: { breadcrumb: 'adaptation.cta' },
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
          import('./features/idea-creator/pages/materials/materials.component').then(
            (m) => m.MaterialsComponent,
          ),
        data: { breadcrumb: 'nav.materials' },
      },
      {
        path: 'zasobnik/admin',
        loadComponent: () =>
          import('./features/knowledge/knowledge-admin.component').then(
            (m) => m.KnowledgeAdminComponent,
          ),
        data: { breadcrumb: 'knowledge.admin.heading' },
      },
      {
        path: 'zasobnik/temat/:area',
        loadComponent: () =>
          import('./features/knowledge/knowledge-topic.component').then(
            (m) => m.KnowledgeTopicComponent,
          ),
        data: { breadcrumb: 'knowledge.topic.breadcrumb' },
      },
      {
        path: 'zasobnik',
        loadComponent: () =>
          import('./features/knowledge/knowledge.component').then(
            (m) => m.KnowledgeComponent,
          ),
        data: { breadcrumb: 'knowledge.title' },
      },
      {
        path: 'rops-contact',
        loadComponent: () =>
          import('./features/rops-contact/rops-contact.component').then(
            (m) => m.RopsContactComponent,
          ),
        data: { breadcrumb: 'nav.rops_contact' },
      },
      { path: 'contact', redirectTo: 'rops-contact', pathMatch: 'full' },
    ],
  },
];
