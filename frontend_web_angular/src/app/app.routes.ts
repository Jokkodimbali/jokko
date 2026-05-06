import { Routes } from '@angular/router';
import { ServicesComponent } from './features/services/presentation/pages/services/services.component';
import { MedicinePageComponent } from './features/medicine/presentation/pages/medicine-page/medicine-page.component';
import { MedicineDoctorProfileComponent } from './features/medicine/presentation/pages/medicine-doctor-profile/medicine-doctor-profile.component';
import { ProviderProfileComponent } from './features/services/presentation/pages/provider-profile/provider-profile.component';
import { FavoritesPageComponent } from './features/account/pages/favorites/favorites-page.component';
import { SettingsPageComponent } from './features/account/pages/settings/settings-page.component';
import { SimpleAccountPageComponent } from './features/account/pages/simple-account-page.component';

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
    component: SimpleAccountPageComponent,
    data: {
      title: 'Rendez vous',
      subtitle: 'Suivez vos rendez-vous et vos prochaines interventions.',
      emptyTitle: 'Aucun rendez-vous affiche pour le moment',
      emptyText: 'Le module web de rendez-vous est pret cote navigation. Les donnees seront raccordees au flux reservation lorsque la page metier sera implementee.',
    },
  },
  {
    path: 'messages',
    component: SimpleAccountPageComponent,
    data: {
      title: 'Messages',
      subtitle: 'Retrouvez vos conversations avec les prestataires et les clients.',
      emptyTitle: 'Aucune conversation affichee pour le moment',
      emptyText: 'Le module web de messagerie est pret cote navigation. Les donnees seront raccordees au backend messagerie lorsque la page metier sera implementee.',
    },
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
