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
    pathMatch: 'full',
    redirectTo: 'services',
  },
  {
    path: 'medecine/espace/rdv-patients',
    canActivate: [roleGuard],
    data: { roles: ['MEDECIN'] },
    loadComponent: () =>
      import('./features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component').then(
        (m) => m.DoctorSpacePageComponent,
      ),
  },
  {
    path: 'medecine/espace',
    canActivate: [roleGuard],
    data: { roles: ['MEDECIN'] },
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
    path: 'medecine/reservations/:id/resume-paiement',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointment-payment-page/appointment-payment-page.component').then(
        (m) => m.AppointmentPaymentPageComponent,
      ),
  },
  {
    path: 'medecine/reservations/:id/paiement',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointment-payment-page/appointment-payment-page.component').then(
        (m) => m.AppointmentPaymentPageComponent,
      ),
  },
  {
    path: 'medecine/reservations/:id/confirmation',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/presentation/pages/appointment-payment-page/appointment-payment-page.component').then(
        (m) => m.AppointmentPaymentPageComponent,
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
    path: 'pharmacy-orders/select',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy-orders/presentation/pages/pharmacy-selection-page/pharmacy-selection-page.component').then(
        (m) => m.PharmacySelectionPageComponent,
      ),
  },
  {
    path: 'pharmacy-orders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy-orders/presentation/pages/pharmacy-orders-inbox-page/pharmacy-orders-inbox-page.component').then(
        (m) => m.PharmacyOrdersInboxPageComponent,
      ),
  },
  {
    path: 'pharmacy-orders/:id/payment',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy-orders/presentation/pages/pharmacy-order-payment-page/pharmacy-order-payment-page.component').then(
        (m) => m.PharmacyOrderPaymentPageComponent,
      ),
  },
  {
    path: 'pharmacy-orders/:id/delivery',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy-orders/presentation/pages/pharmacy-order-delivery-page/pharmacy-order-delivery-page.component').then(
        (m) => m.PharmacyOrderDeliveryPageComponent,
      ),
  },
  {
    path: 'pharmacy-orders/:id/delivery-offer',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy-orders/presentation/pages/pharmacy-delivery-offer-page/pharmacy-delivery-offer-page.component').then(
        (m) => m.PharmacyDeliveryOfferPageComponent,
      ),
  },
  {
    path: 'pharmacy-orders/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy-orders/presentation/pages/pharmacy-order-detail-page/pharmacy-order-detail-page.component').then(
        (m) => m.PharmacyOrderDetailPageComponent,
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
    path: 'contact',
    loadComponent: () =>
      import('./features/public/pages/contact-page/contact-page.component').then(
        (m) => m.ContactPageComponent,
      ),
  },
  {
    path: 'a-propos',
    loadComponent: () =>
      import('./features/public/pages/about-page/about-page.component').then(
        (m) => m.AboutPageComponent,
      ),
  },
  {
    path: 'faq',
    redirectTo: 'contact',
    pathMatch: 'full',
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
