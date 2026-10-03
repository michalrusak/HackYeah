import { Routes } from '@angular/router';
import { AppLayoutComponent } from './core/layout/app-layout/app-layout.component';
import { AboutComponent } from './pages/about/about.component';
import { ContactComponent } from './pages/contact/contact.component';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: '', component: HomeComponent, data: { breadcrumb: 'nav.home' } },
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
