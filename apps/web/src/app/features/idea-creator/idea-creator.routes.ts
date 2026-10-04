import type { Routes } from '@angular/router';
import { IdeaWorkspaceComponent } from './idea-workspace.component';

/**
 * Powłoka z panelem asystenta obejmuje wszystkie widoki pracy nad pomysłem,
 * dzięki czemu rozmowa przeżywa nawigację między nimi.
 */
export const ideaRoutes: Routes = [
  {
    path: '',
    component: IdeaWorkspaceComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/idea-list/idea-list.component').then(
            (m) => m.IdeaListComponent,
          ),
        data: { breadcrumb: 'nav.ideas' },
      },
      {
        path: 'nowy',
        loadComponent: () =>
          import('./pages/idea-new/idea-new.component').then(
            (m) => m.IdeaNewComponent,
          ),
        data: { breadcrumb: 'ideaCreator.new.title' },
      },
      {
        path: 'moje',
        loadComponent: () =>
          import('./pages/my-ideas/my-ideas.component').then(
            (m) => m.MyIdeasComponent,
          ),
        data: { breadcrumb: 'ideaCreator.mine.title' },
      },
      {
        path: ':id',
        data: { breadcrumb: 'a11y.ideaDetail' },
        loadComponent: () =>
          import('./pages/idea-detail/idea-detail.component').then(
            (m) => m.IdeaDetailComponent,
          ),
      },
      {
        path: ':id/canva',
        data: { breadcrumb: 'ideaCreator.detail.canvas' },
        loadComponent: () =>
          import('./pages/idea-canvas/idea-canvas.component').then(
            (m) => m.IdeaCanvasComponent,
          ),
      },
    ],
  },
];

export const callRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/calls/calls.component').then((m) => m.CallsComponent),
    data: { breadcrumb: 'nav.calls' },
  },
  {
    path: ':callId/wniosek/:applicationId',
    loadComponent: () =>
      import('./pages/application/application.component').then(
        (m) => m.ApplicationComponent,
      ),
    data: { breadcrumb: 'ideaCreator.application.title' },
  },
];
