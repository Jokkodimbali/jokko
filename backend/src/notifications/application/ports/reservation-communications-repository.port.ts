import type { NotificationMetadata } from '../../domain/entities/notification.entity';

export const RESERVATION_COMMUNICATIONS_REPOSITORY_PORT = Symbol(
  'RESERVATION_COMMUNICATIONS_REPOSITORY_PORT',
);

export type NotificationDispatchStatus =
  | 'EN_ATTENTE'
  | 'ENVOYE'
  | 'ECHEC'
  | 'CONFIGURATION_MANQUANTE';

export type CreateReservationCommunicationDispatchesInput = {
  reservationId: string;
  userId: string;
  email?: string | null;
  phoneNumber: string;
  emailSubject: string;
  emailContent: string;
  smsContent: string;
  metadata: NotificationMetadata;
};

export type ReservationCommunicationDispatches = {
  emailDispatchId: string | null;
  smsDispatchId: string;
};

export type UpdateReservationCommunicationDispatchInput = {
  dispatchId: string;
  status: NotificationDispatchStatus;
  provider?: string;
  providerMessageId?: string | null;
  error?: string | null;
};

export interface ReservationCommunicationsRepositoryPort {
  createReservationCreatedDispatches(
    input: CreateReservationCommunicationDispatchesInput,
  ): Promise<ReservationCommunicationDispatches>;
  updateDispatchResult(
    input: UpdateReservationCommunicationDispatchInput,
  ): Promise<void>;
}
