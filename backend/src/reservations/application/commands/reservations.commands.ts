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
  dureeMinutes: number;
  notes?: string;
};

export type CancelReservationCommand = {
  reason?: string;
};

export type RescheduleReservationCommand = {
  newDateTime: string;
};

export type ListReservationsQuery = {
  startDate?: string;
  endDate?: string;
  scope?: 'CLIENT' | 'PRESTATAIRE';
  status?: string;
  serviceId?: string;
};

export type ReservationFilters = {
  clientId?: string;
  professionalId?: string;
  serviceId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
};
