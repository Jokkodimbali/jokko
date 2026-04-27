import type { Reservation } from '../../domain/entities/reservation.entity';

export const RESERVATIONS_REPOSITORY_PORT = Symbol(
  'RESERVATIONS_REPOSITORY_PORT',
);

export interface ReservationsRepositoryPort {
  findAllByDateRange(startDate: Date, endDate: Date): Promise<Reservation[]>;
  findById(id: string): Promise<Reservation | null>;
  findByClient(clientId: string): Promise<Reservation[]>;
  findByClientAndDateRange(
    clientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]>;
  findByProfessional(professionalId: string): Promise<Reservation[]>;
  findByProfessionalAndDateRange(
    professionalId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]>;
  findByService(serviceId: string): Promise<Reservation[]>;
  findByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<Reservation>;
  saveFromNegotiation(
    reservation: Reservation,
    negotiationId: string,
  ): Promise<Reservation | null>;
  hasPaymentForReservation(reservationId: string): Promise<boolean>;
  update(reservation: Reservation): Promise<Reservation>;
  delete(id: string): Promise<void>;
}
