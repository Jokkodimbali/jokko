import { Routes } from '@angular/router';
import { ServicesComponent } from './features/services/presentation/pages/services/services.component';
import { MedicinePageComponent } from './features/medicine/presentation/pages/medicine-page/medicine-page.component';

export const routes: Routes = [
  {
    path: 'services',
    component: ServicesComponent,
  },
  {
    path: 'medecine',
    component: MedicinePageComponent,
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    redirectTo: 'services',
    pathMatch: 'full',
  },
];
