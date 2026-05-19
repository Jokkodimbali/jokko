import { Routes } from '@angular/router';
import { ServicesComponent } from './features/services/presentation/pages/services/services.component';
import { MedicinePageComponent } from './features/medicine/presentation/pages/medicine-page/medicine-page.component';
import { MedicineDoctorProfileComponent } from './features/medicine/presentation/pages/medicine-doctor-profile/medicine-doctor-profile.component';
import { MedicineAppointmentBookingComponent } from './features/medicine/presentation/pages/medicine-appointment-booking/medicine-appointment-booking.component';
import { DoctorSpacePageComponent } from './features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component';
import { ProviderProfileComponent } from './features/services/presentation/pages/provider-profile/provider-profile.component';
import { ServiceProposalComponent } from './features/services/presentation/pages/service-proposal/service-proposal.component';
import { FavoritesPageComponent } from './features/account/pages/favorites/favorites-page.component';
import { SettingsPageComponent } from './features/account/pages/settings/settings-page.component';
import { AppointmentsPageComponent } from './features/appointments/presentation/pages/appointments-page/appointments-page.component';
import { AppointmentDetailPageComponent } from './features/appointments/presentation/pages/appointment-detail-page/appointment-detail-page.component';
import { AppointmentPaymentPageComponent } from './features/appointments/presentation/pages/appointment-payment-page/appointment-payment-page.component';
import { MessagesPageComponent } from './features/messages/presentation/pages/messages-page/messages-page.component';
import { AdminDashboardPageComponent } from './features/admin/presentation/pages/admin-dashboard-page/admin-dashboard-page.component';

export const routes: Routes = [
  {
    path: 'services',
    component: ServicesComponent,
  },
  {
    path: 'services/:id/proposition',
    component: ServiceProposalComponent,
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
    path: 'medecine/espace',
    component: DoctorSpacePageComponent,
  },
  {
    path: 'prestataire/espace',
    component: DoctorSpacePageComponent,
  },
  {
    path: 'medecine/:id/rendez-vous',
    component: MedicineAppointmentBookingComponent,
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
    path: 'appointments/:id/payment',
    component: AppointmentPaymentPageComponent,
  },
  {
    path: 'appointments/:id',
    component: AppointmentDetailPageComponent,
  },
  {
    path: 'messages',
    component: MessagesPageComponent,
  },
  {
    path: 'admin',
    component: AdminDashboardPageComponent,
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
