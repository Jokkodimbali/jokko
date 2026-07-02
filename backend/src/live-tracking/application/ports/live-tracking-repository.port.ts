import type {
  ProfessionalPresence,
  ProfessionalPresenceStatus,
} from '../../domain/entities/professional-presence.entity';
import type { ReservationTrackingSession } from '../../domain/entities/reservation-tracking-session.entity';

export const LIVE_TRACKING_REPOSITORY_PORT = Symbol(
  'LIVE_TRACKING_REPOSITORY_PORT',
);

export type ReservationTrackingContext = {
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  professionalUserId: string;
  professionalName: string;
  serviceName: string;
  dateHeure: Date;
  adresseClient: string;
  adresseDestinationPrestataire: string;
  reservationStatus: string;
  travelMode: 'PRESTATAIRE_SE_DEPLACE' | 'CLIENT_SE_DEPLACE' | 'TRANSPORT_COLIS';
};

export type ReservationTrackingView = ReservationTrackingSession & {
  presence: ProfessionalPresence;
  route?: {
    distanceRemainingMeters: number;
    durationRemainingSeconds: number;
    estimatedArrivalAt: string;
    encodedPolyline: string;
    coordinates: Array<{ latitude: number; longitude: number }>;
    navigationSteps?: Array<{
      id: string;
      instruction: string;
      maneuver: string | null;
      distanceMeters: number | null;
      durationSeconds: number | null;
      start: { latitude: number; longitude: number } | null;
      end: { latitude: number; longitude: number } | null;
    }>;
  } | null;
};

export interface LiveTrackingRepositoryPort {
  findReservationContext(
    reservationId: string,
  ): Promise<ReservationTrackingContext | null>;
  findProfessionalPresence(
    professionalId: string,
  ): Promise<ProfessionalPresence | null>;
  findTrackingByReservationId(
    reservationId: string,
  ): Promise<ReservationTrackingView | null>;
  upsertPresence(input: {
    professionalId: string;
    isOnline?: boolean;
    status?: ProfessionalPresenceStatus;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): Promise<ProfessionalPresence>;
  startOrResumeTracking(input: {
    session: ReservationTrackingSession;
    presence: ProfessionalPresence;
  }): Promise<ReservationTrackingView>;
  startOrResumeTravelerTracking(input: {
    session: ReservationTrackingSession;
  }): Promise<ReservationTrackingView>;
  recordTrackingLocation(input: {
    reservationId: string;
    professionalId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): Promise<ReservationTrackingView | null>;
  recordTravelerTrackingLocation(input: {
    reservationId: string;
    professionalId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): Promise<ReservationTrackingView | null>;
  startReservationFromArrival(input: {
    reservationId: string;
    professionalId: string;
  }): Promise<ReservationTrackingView | null>;
  finalizeTrackingForReservation(input: {
    reservationId: string;
    professionalId: string;
    trackingStatus: 'TERMINEE' | 'ANNULEE';
    nextPresenceStatus: ProfessionalPresenceStatus;
  }): Promise<ReservationTrackingView | null>;
}
