import { Routes } from '@angular/router';
import { AppLayoutComponent } from './core/layout/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: 'dostepnosc',
        loadComponent: () =>
          import('./pages/accessibility/accessibility.component').then(
            (m) => m.AccessibilityComponent,
          ),
        data: { breadcrumb: 'a11y.title' },
      },
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
        path: 'nabory/:callId/wniosek/:applicationId',
        redirectTo: 'pomysly/nabory/:callId/wniosek/:applicationId',
        pathMatch: 'full',
      },
      {
        path: 'nabory',
        redirectTo: 'pomysly/nabory',
        pathMatch: 'full',
      },
      {
        path: 'materialy',
        redirectTo: 'pomysly/materialy',
        pathMatch: 'full',
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
      {
        path: 'ekspert',
        loadComponent: () =>
          import('./features/expert/expert-panel.component').then(
            (m) => m.ExpertPanelComponent,
          ),
        data: { breadcrumb: 'nav.expert' },
      },
      { path: 'contact', redirectTo: 'rops-contact', pathMatch: 'full' },
    ],
  },
];
