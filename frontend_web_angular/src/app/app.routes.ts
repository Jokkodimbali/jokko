import { Routes } from '@angular/router';
import { ServicesComponent } from './features/services/presentation/pages/services/services.component';

export const routes: Routes = [
  {
    path: 'services',
    component: ServicesComponent
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes)
  },
  {
    path: '',
    redirectTo: 'services',
    pathMatch: 'full'
  }
];
