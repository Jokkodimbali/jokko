export type CreateReservationCommand = {
  professionnelId: string;
  serviceId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  notes?: string;
};

export type CreateReservationFromNegotiationCommand = {
  negotiationId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  notes?: string;
};

export type CancelReservationCommand = {
  reason?: string;
};

export type RescheduleReservationCommand = {
  newDateTime: string;
};

export type ProposeReservationPriceAdjustmentCommand = {
  proposedPrice: number;
  reason?: string;
};

export type SubmitReservationReviewCommand = {
  rating: number;
  review?: string;
};

export type ListReservationsQuery = {
  startDate?: string;
  endDate?: string;
  scope?: 'CLIENT' | 'PRESTATAIRE';
  status?: string;
  serviceId?: string;
  clientId?: string;
  professionalId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type ReservationFilters = {
  clientId?: string;
  professionalId?: string;
  serviceId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
};
