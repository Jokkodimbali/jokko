import type { Reservation } from '../../domain/entities/reservation.entity';

export const RESERVATIONS_REPOSITORY_PORT = Symbol(
  'RESERVATIONS_REPOSITORY_PORT',
);

export interface ReservationsRepositoryPort {
  syncOverdueReservations(now: Date): Promise<number>;
  findAllByDateRange(startDate: Date, endDate: Date): Promise<Reservation[]>;
  findAllDetailedByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<ReservationDetailedView[]>;
  findById(id: string): Promise<Reservation | null>;
  findDetailedById(id: string): Promise<ReservationDetailedView | null>;
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
    excludeStatuses?: string[];
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<Reservation[]>;
  findDetailedByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    excludeStatuses?: string[];
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReservationDetailedView[]>;
  countByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    excludeStatuses?: string[];
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<number>;
  hasTimeSlotConflict(input: {
    professionalId: string;
    dateHeure: Date;
    dureeMinutes: number;
    excludeReservationId?: string;
  }): Promise<boolean>;
  save(reservation: Reservation): Promise<Reservation>;
  saveFromNegotiation(
    reservation: Reservation,
    negotiationId: string,
  ): Promise<Reservation | null>;
  hasPaymentForReservation(reservationId: string): Promise<boolean>;
  findPaymentIdForReservation(reservationId: string): Promise<string | null>;
  submitClientReview(reservation: Reservation): Promise<Reservation>;
  update(reservation: Reservation): Promise<Reservation>;
  delete(id: string): Promise<void>;
}

export type ReservationDetailedView = Reservation & {
  client: {
    id: string;
    nom: string;
    numeroTelephone: string;
    email: string | null;
    adresse: string | null;
    urlAvatar: string | null;
  };
  service: {
    id: string;
    profilProfessionnelId: string;
    categorieId: string;
    nom: string;
    description: string;
    prix: number;
    typePrix: string;
    modeDeplacement:
      | 'PRESTATAIRE_SE_DEPLACE'
      | 'CLIENT_SE_DEPLACE'
      | 'TRANSPORT_COLIS';
    dureeMinutes: number;
    estObligatoire: boolean;
    estDisponible: boolean;
    categorie: {
      id: string;
      nom: string;
      urlIcone: string | null;
      tauxCommission: number;
    };
  };
  professionnel: {
    id: string;
    utilisateurId: string;
    nomEntreprise: string | null;
    ville: string | null;
    noteGlobale: number;
    nombreAvis: number;
    typeVehicule: 'MOTO_SCOOTER' | 'VOITURE' | 'CAMIONNETTE' | null;
    utilisateur: {
      id: string;
      nom: string;
      numeroTelephone: string;
      urlAvatar: string | null;
    };
  };
};
