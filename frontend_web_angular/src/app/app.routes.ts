import { Routes } from '@angular/router';
import { ServicesComponent } from './features/services/presentation/pages/services/services.component';
import { MedicinePageComponent } from './features/medicine/presentation/pages/medicine-page/medicine-page.component';
import { MedicineDoctorProfileComponent } from './features/medicine/presentation/pages/medicine-doctor-profile/medicine-doctor-profile.component';
import { ProviderProfileComponent } from './features/services/presentation/pages/provider-profile/provider-profile.component';
import { FavoritesPageComponent } from './features/account/pages/favorites/favorites-page.component';
import { SettingsPageComponent } from './features/account/pages/settings/settings-page.component';
import { AppointmentsPageComponent } from './features/appointments/presentation/pages/appointments-page/appointments-page.component';
import { MessagesPageComponent } from './features/messages/presentation/pages/messages-page/messages-page.component';

export const routes: Routes = [
  {
    path: 'services',
    component: ServicesComponent,
  },
  {
    path: 'services/:id',
    component: ProviderProfileComponent,
  },
  {
    path: 'medecine',
    component: MedicinePageComponent,
  },
  {
    path: 'medecine/:id',
    component: MedicineDoctorProfileComponent,
  },
  {
    path: 'favorites',
    component: FavoritesPageComponent,
  },
  {
    path: 'settings',
    component: SettingsPageComponent,
  },
  {
    path: 'appointments',
    component: AppointmentsPageComponent,
  },
  {
    path: 'messages',
    component: MessagesPageComponent,
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
