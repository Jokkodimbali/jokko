export type AppointmentStatus =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

export interface BackendReservation {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  statut: AppointmentStatus;
  notes: string | null;
  prixConvenu: number | null;
  clientRating: number | null;
  clientReview: string | null;
  clientReviewedAt: string | null;
  raisonAnnulation: string | null;
  creeLe: string;
  misAJourLe: string;
}

export interface AppointmentView {
  id: string;
  professionalId: string;
  serviceId: string;
  status: AppointmentStatus;
  scheduledAt: string;
  durationMinutes: number;
  eyebrow: string;
  dateLabel: string;
  shortDateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  locationLabel: string;
  doctorName: string;
  specialty: string;
  avatarUrl: string;
  serviceName: string;
  notes: string | null;
  agreedPrice: number | null;
  confirmationLabel: string;
  addressLabel: string;
}

export interface AppointmentStat {
  label: string;
  value: number;
  caption: string;
}
