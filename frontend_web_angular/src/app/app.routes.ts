import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'services',
    loadComponent: () =>
      import('./features/services/presentation/pages/services/services.component').then(
        (m) => m.ServicesComponent,
      ),
  },
  {
    path: 'services/:id/proposition',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/services/presentation/pages/service-proposal/service-proposal.component').then(
        (m) => m.ServiceProposalComponent,
      ),
  },
  {
    path: 'services/:id',
    loadComponent: () =>
      import('./features/services/presentation/pages/provider-profile/provider-profile.component').then(
        (m) => m.ProviderProfileComponent,
      ),
  },
  {
    path: 'medecine',
    loadComponent: () =>
      import('./features/medicine/presentation/pages/medicine-page/medicine-page.component').then(
        (m) => m.MedicinePageComponent,
      ),
  },
  {
    path: 'medecine/espace',
    canActivate: [roleGuard],
    data: { roles: ['MEDECIN', 'PRESTATAIRE'] },
    loadComponent: () =>
      import('./features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component').then(
        (m) => m.DoctorSpacePageComponent,
      ),
  },
  {
    path: 'prestataire/espace',
    canActivate: [roleGuard],
    data: { roles: ['PRESTATAIRE'] },
    loadComponent: () =>
      import('./features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component').then(
        (m) => m.DoctorSpacePageComponent,
      ),
  },
  {
    path: 'medecine/:id/rendez-vous',
    loadComponent: () =>
      import('./features/medicine/presentation/pages/medicine-appointment-booking/medicine-appointment-booking.component').then(
        (m) => m.MedicineAppointmentBookingComponent,
      ),
  },
  {
    path: 'medecine/:id',
    loadComponent: () =>
      import('./features/medicine/presentation/pages/medicine-doctor-profile/medicine-doctor-profile.component').then(
        (m) => m.MedicineDoctorProfileComponent,
      ),
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/favorites/favorites-page.component').then(
        (m) => m.FavoritesPageComponent,
      ),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/notifications/notifications-page.component').then(
        (m) => m.NotificationsPageComponent,
      ),
  },
  {
    path: 'litiges',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/disputes/disputes-page.component').then(
        (m) => m.DisputesPageComponent,
      ),
  },
  {
    path: 'litiges/:id/suivi',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/dispute-tracking/dispute-tracking-page.component').then(
        (m) => m.DisputeTrackingPageComponent,
      ),
  },
  {
    path: 'litiges/:id/messages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/dispute-messages/dispute-messages-page.component').then(
        (m) => m.DisputeMessagesPageComponent,
      ),
  },
  {
    path: 'litiges/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/dispute-report/dispute-report-page.component').then(
        (m) => m.DisputeReportPageComponent,
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/settings/settings-page.component').then(
        (m) => m.SettingsPageComponent,
      ),
  },
  {
    path: 'appointments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointments-page/appointments-page.component').then(
        (m) => m.AppointmentsPageComponent,
      ),
  },
  {
    path: 'appointments/:id/payment',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointment-payment-page/appointment-payment-page.component').then(
        (m) => m.AppointmentPaymentPageComponent,
      ),
  },
  {
    path: 'appointments/:id/qr/:type',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointment-qr-code-page/appointment-qr-code-page.component').then(
        (m) => m.AppointmentQrCodePageComponent,
      ),
  },
  {
    path: 'appointments/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointment-detail-page/appointment-detail-page.component').then(
        (m) => m.AppointmentDetailPageComponent,
      ),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/messages/presentation/pages/messages-page/messages-page.component').then(
        (m) => m.MessagesPageComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () =>
      import('./features/admin/presentation/pages/admin-dashboard-page/admin-dashboard-page.component').then(
        (m) => m.AdminDashboardPageComponent,
      ),
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
