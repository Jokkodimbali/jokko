import { Inject, Injectable } from '@nestjs/common';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../../../users/application/ports/users-repository.port';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import { RESERVATION_NOTIFICATION_MESSAGES } from '../../../core/messages/reservation-notification.messages';
import { NOTIFICATION_TYPES } from '../../domain/entities/notification.entity';
import {
  type NotificationDispatchStatus,
  RESERVATION_COMMUNICATIONS_REPOSITORY_PORT,
  type ReservationCommunicationsRepositoryPort,
} from '../ports/reservation-communications-repository.port';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationsService } from './notifications.service';

type ReservationCreatedNotificationInput = {
  reservationId: string;
  clientId: string;
  serviceName: string;
  professionalName: string;
  dateHeure: Date;
  adresseClient: string;
};

type ReservationPriceAdjustmentNotificationInput = {
  reservationId: string;
  clientId: string;
  serviceName: string;
  professionalName: string;
  dateHeure: Date;
  adresseClient: string;
  currentPrice: number | null;
  proposedPrice: number;
  reason?: string | null;
};

type ReservationProfessionalPriceAdjustmentNotificationInput = {
  reservationId: string;
  professionalUserId: string;
  serviceName: string;
  proposedPrice: number;
};

type ReservationProfessionalCancellationNotificationInput = {
  reservationId: string;
  professionalUserId: string;
  clientName: string;
  serviceName: string;
  dateHeure: Date;
  reason?: string | null;
};

type ReservationProfessionalCreatedNotificationInput = {
  reservationId: string;
  professionalUserId: string;
  clientName: string;
  serviceName: string;
  dateHeure: Date;
  typeConsultation?: 'CONSULTATION' | 'TELECONSULTATION';
};

type ReservationArrivalNotificationInput = {
  reservationId: string;
  recipientUserId: string;
  travellerName: string;
  serviceName: string;
  travellerRole: 'CLIENT' | 'PROFESSIONNEL';
};

type ReservationTripStatusNotificationInput = {
  reservationId: string;
  recipientUserId: string;
  serviceName: string;
  travellerRole: 'CLIENT' | 'PROFESSIONNEL';
  tripStatus: 'EN_ROUTE' | 'TERMINEE' | 'ANNULEE';
};

type DispatchResult = {
  status: NotificationDispatchStatus;
  provider?: string;
  providerMessageId?: string | null;
  error?: string | null;
};

@Injectable()
export class ReservationClientNotificationService {
  constructor(
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
    @Inject(RESERVATION_COMMUNICATIONS_REPOSITORY_PORT)
    private readonly reservationCommunicationsRepository: ReservationCommunicationsRepositoryPort,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyReservationCreated(
    input: ReservationCreatedNotificationInput,
  ): Promise<void> {
    const client = await this.usersRepository.findMeById(input.clientId);
    if (!client) {
      return;
    }

    const formattedDate = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const title = RESERVATION_NOTIFICATION_MESSAGES.createdTitle;
    const body = RESERVATION_NOTIFICATION_MESSAGES.createdPushBody({
      clientName: client.nom,
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
      address: input.adresseClient,
    });
    const smsBody = RESERVATION_NOTIFICATION_MESSAGES.createdSmsBody({
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
    });
    const communicationMetadata = {
      reservationId: input.reservationId,
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      dateHeure: input.dateHeure.toISOString(),
      adresseClient: input.adresseClient,
    };

    await this.notificationsService.createInAppNotification({
      userId: input.clientId,
      type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
      title,
      body,
      data: communicationMetadata,
    });

    const createdRecords =
      await this.reservationCommunicationsRepository.createReservationDispatches(
        {
          reservationId: input.reservationId,
          userId: input.clientId,
          email: client.email,
          phoneNumber: client.numeroTelephone,
          emailSubject: RESERVATION_NOTIFICATION_MESSAGES.createdEmailSubject,
          emailContent: body,
          smsContent: smsBody,
          metadata: communicationMetadata,
        },
      );

    if (client.email) {
      await this.eventBus.publier({
        nom: 'reservations.client.email-requested',
        dateOccurrence: new Date(),
        payload: {
          reservationId: input.reservationId,
          recipientUserId: client.id,
          recipientEmail: client.email,
          recipientName: client.nom,
          subject: RESERVATION_NOTIFICATION_MESSAGES.createdEmailSubject,
          body,
        },
      });

      const emailResult = await this.deliveryService.sendEmail({
        to: client.email,
        subject: RESERVATION_NOTIFICATION_MESSAGES.createdEmailSubject,
        text: body,
      });
      if (createdRecords.emailDispatchId) {
        await this.updateDispatchResult(
          createdRecords.emailDispatchId,
          emailResult,
        );
      }
    }

    await this.eventBus.publier({
      nom: 'reservations.client.sms-requested',
      dateOccurrence: new Date(),
      payload: {
        reservationId: input.reservationId,
        recipientUserId: client.id,
        recipientPhoneNumber: client.numeroTelephone,
        recipientName: client.nom,
        body: smsBody,
      },
    });

    const smsResult = await this.deliveryService.sendSms({
      to: client.numeroTelephone,
      body: smsBody,
    });
    if (createdRecords.smsDispatchId) {
      await this.updateDispatchResult(createdRecords.smsDispatchId, smsResult);
    }
  }

  async notifyReservationConfirmed(
    input: ReservationCreatedNotificationInput,
  ): Promise<void> {
    await this.notifyGenericEvent(input, 'RESERVATION_CONFIRMEE', 'confirmee');
  }

  async notifyReservationCreatedForProfessional(
    input: ReservationProfessionalCreatedNotificationInput,
  ): Promise<void> {
    const formattedDate = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const consultationLabel =
      input.typeConsultation === 'TELECONSULTATION'
        ? ' en teleconsultation'
        : '';

    await this.notificationsService.createInAppNotification({
      userId: input.professionalUserId,
      type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
      title: 'Nouvelle reservation confirmee',
      body: `${input.clientName} a confirme une reservation${consultationLabel} pour ${input.serviceName}, prevue le ${formattedDate}.`,
      data: {
        reservationId: input.reservationId,
        serviceName: input.serviceName,
        clientName: input.clientName,
        dateHeure: input.dateHeure.toISOString(),
        typeConsultation: input.typeConsultation ?? 'CONSULTATION',
      },
    });
  }

  async notifyReservationArrival(
    input: ReservationArrivalNotificationInput,
  ): Promise<void> {
    const travellerLabel =
      input.travellerRole === 'CLIENT' ? 'Le client' : 'Votre prestataire';
    await this.notificationsService.createInAppNotification({
      userId: input.recipientUserId,
      // This existing type is intentionally reused: the widget keeps a trip
      // state visible after reading until the reservation is closed.
      type: NOTIFICATION_TYPES.PRESTATAIRE_EN_ROUTE,
      title: `${travellerLabel} est sur place`,
      body: `${input.travellerName} est sur place pour la reservation ${input.serviceName}.`,
      data: {
        reservationId: input.reservationId,
        serviceName: input.serviceName,
        travellerRole: input.travellerRole,
        tripStatus: 'SUR_PLACE',
        persistentUntilTerminal: true,
      },
    });
  }

  async notifyReservationCancelled(
    input: ReservationCreatedNotificationInput,
  ): Promise<void> {
    await this.notifyGenericEvent(input, 'RESERVATION_ANNULEE', 'annulee');
  }

  async notifyReservationCancelledForProfessional(
    input: ReservationProfessionalCancellationNotificationInput,
  ): Promise<void> {
    const formattedDate = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const reason = input.reason?.trim();

    await this.notificationsService.createInAppNotification({
      userId: input.professionalUserId,
      type: NOTIFICATION_TYPES.RESERVATION_ANNULEE,
      title: 'Reservation annulee',
      body: `${input.clientName} a annule la reservation pour ${input.serviceName} prevue le ${formattedDate}.${reason ? ` Motif : ${reason}` : ''}`,
      data: {
        reservationId: input.reservationId,
        serviceName: input.serviceName,
        clientName: input.clientName,
        dateHeure: input.dateHeure.toISOString(),
        reason: reason ?? null,
      },
    });
  }

  async notifyReservationCompleted(
    input: ReservationCreatedNotificationInput,
  ): Promise<void> {
    await this.notifyGenericEvent(input, 'RESERVATION_FINALISEE', 'finalisee');
  }

  async notifyTripStatus(
    input: ReservationTripStatusNotificationInput,
  ): Promise<void> {
    const travellerIsProfessional = input.travellerRole === 'PROFESSIONNEL';
    const copy =
      input.tripStatus === 'EN_ROUTE'
        ? travellerIsProfessional
          ? {
              type: NOTIFICATION_TYPES.PRESTATAIRE_EN_ROUTE,
              title: 'Vous etes en route',
              body: `Vous etes en route pour la reservation ${input.serviceName}.`,
            }
          : {
              type: NOTIFICATION_TYPES.PRESTATAIRE_EN_ROUTE,
              title: 'Le client est en route',
              body: `Le client se rend a la reservation ${input.serviceName}.`,
            }
        : input.tripStatus === 'TERMINEE'
          ? {
              type: NOTIFICATION_TYPES.RESERVATION_FINALISEE,
              title: 'Prestation terminee',
              body: `La reservation ${input.serviceName} est terminee.`,
            }
          : {
              type: NOTIFICATION_TYPES.RESERVATION_ANNULEE,
              title: 'Reservation annulee',
              body: `La reservation ${input.serviceName} a ete annulee.`,
            };

    await this.notificationsService.createInAppNotification({
      userId: input.recipientUserId,
      type: copy.type,
      title: copy.title,
      body: copy.body,
      data: {
        reservationId: input.reservationId,
        serviceName: input.serviceName,
        travellerRole: input.travellerRole,
        tripStatus: input.tripStatus,
        persistentUntilTerminal: input.tripStatus === 'EN_ROUTE',
      },
    });
  }

  async notifyProfessionalOnTheWay(
    input: ReservationCreatedNotificationInput,
  ): Promise<void> {
    const client = await this.usersRepository.findMeById(input.clientId);
    if (!client) {
      return;
    }

    const formattedDate = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const title = RESERVATION_NOTIFICATION_MESSAGES.onTheWayTitle;
    const body = RESERVATION_NOTIFICATION_MESSAGES.onTheWayBody({
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
    });
    const smsBody = RESERVATION_NOTIFICATION_MESSAGES.onTheWaySmsBody({
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
    });
    const communicationMetadata = {
      reservationId: input.reservationId,
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      dateHeure: input.dateHeure.toISOString(),
      adresseClient: input.adresseClient,
    };

    await this.notificationsService.createInAppNotification({
      userId: input.clientId,
      type: NOTIFICATION_TYPES.PRESTATAIRE_EN_ROUTE,
      title,
      body,
      data: communicationMetadata,
    });

    const createdRecords =
      await this.reservationCommunicationsRepository.createReservationDispatches(
        {
          reservationId: input.reservationId,
          userId: input.clientId,
          email: client.email,
          phoneNumber: client.numeroTelephone,
          emailSubject: RESERVATION_NOTIFICATION_MESSAGES.onTheWayEmailSubject,
          emailContent: body,
          smsContent: smsBody,
          metadata: communicationMetadata,
        },
      );

    if (client.email) {
      const emailResult = await this.deliveryService.sendEmail({
        to: client.email,
        subject: RESERVATION_NOTIFICATION_MESSAGES.onTheWayEmailSubject,
        text: body,
      });
      if (createdRecords.emailDispatchId) {
        await this.updateDispatchResult(
          createdRecords.emailDispatchId,
          emailResult,
        );
      }
    }

    const smsResult = await this.deliveryService.sendSms({
      to: client.numeroTelephone,
      body: smsBody,
    });
    if (createdRecords.smsDispatchId) {
      await this.updateDispatchResult(createdRecords.smsDispatchId, smsResult);
    }
  }

  async notifyPriceAdjustmentProposed(
    input: ReservationPriceAdjustmentNotificationInput,
  ): Promise<void> {
    const client = await this.usersRepository.findMeById(input.clientId);
    if (!client) {
      return;
    }

    const formattedDate = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const title =
      RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentProposedTitle;
    const body = RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentProposedBody({
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
      currentPrice: input.currentPrice,
      proposedPrice: input.proposedPrice,
      reason: input.reason,
    });
    const smsBody =
      RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentProposedSmsBody({
        serviceName: input.serviceName,
        professionalName: input.professionalName,
        proposedPrice: input.proposedPrice,
      });
    const communicationMetadata = {
      reservationId: input.reservationId,
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      dateHeure: input.dateHeure.toISOString(),
      adresseClient: input.adresseClient,
      currentPrice: input.currentPrice,
      proposedPrice: input.proposedPrice,
      reason: input.reason ?? null,
    };

    await this.notificationsService.createInAppNotification({
      userId: input.clientId,
      type: NOTIFICATION_TYPES.AJUSTEMENT_PRIX_PROPOSE,
      title,
      body,
      data: communicationMetadata,
    });

    const createdRecords =
      await this.reservationCommunicationsRepository.createReservationDispatches(
        {
          reservationId: input.reservationId,
          userId: input.clientId,
          email: client.email,
          phoneNumber: client.numeroTelephone,
          emailSubject:
            RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentProposedEmailSubject,
          emailContent: body,
          smsContent: smsBody,
          metadata: communicationMetadata,
        },
      );

    if (client.email) {
      const emailResult = await this.deliveryService.sendEmail({
        to: client.email,
        subject:
          RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentProposedEmailSubject,
        text: body,
      });
      if (createdRecords.emailDispatchId) {
        await this.updateDispatchResult(
          createdRecords.emailDispatchId,
          emailResult,
        );
      }
    }

    const smsResult = await this.deliveryService.sendSms({
      to: client.numeroTelephone,
      body: smsBody,
    });
    if (createdRecords.smsDispatchId) {
      await this.updateDispatchResult(createdRecords.smsDispatchId, smsResult);
    }
  }

  async notifyPriceAdjustmentAccepted(
    input: ReservationProfessionalPriceAdjustmentNotificationInput,
  ): Promise<void> {
    await this.notifyProfessionalPriceAdjustmentResponse(
      input,
      NOTIFICATION_TYPES.AJUSTEMENT_PRIX_ACCEPTE,
      RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentAcceptedTitle,
      RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentAcceptedBody({
        serviceName: input.serviceName,
        proposedPrice: input.proposedPrice,
      }),
    );
  }

  async notifyPriceAdjustmentRejected(
    input: ReservationProfessionalPriceAdjustmentNotificationInput,
  ): Promise<void> {
    await this.notifyProfessionalPriceAdjustmentResponse(
      input,
      NOTIFICATION_TYPES.AJUSTEMENT_PRIX_REFUSE,
      RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentRejectedTitle,
      RESERVATION_NOTIFICATION_MESSAGES.priceAdjustmentRejectedBody({
        serviceName: input.serviceName,
        proposedPrice: input.proposedPrice,
      }),
    );
  }

  private async notifyGenericEvent(
    input: ReservationCreatedNotificationInput,
    type:
      | 'NOUVELLE_RESERVATION'
      | 'RESERVATION_CONFIRMEE'
      | 'RESERVATION_ANNULEE'
      | 'PRESTATAIRE_EN_ROUTE'
      | 'PAIEMENT_LIBERE'
      | 'RESERVATION_FINALISEE',
    eventType: string,
  ): Promise<void> {
    const client = await this.usersRepository.findMeById(input.clientId);
    if (!client) {
      return;
    }

    const formattedDate = input.dateHeure.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const title =
      RESERVATION_NOTIFICATION_MESSAGES.genericEventTitle(eventType);
    const body = RESERVATION_NOTIFICATION_MESSAGES.genericEventBody({
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
      eventType,
    });

    const communicationMetadata = {
      reservationId: input.reservationId,
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      dateHeure: input.dateHeure.toISOString(),
      adresseClient: input.adresseClient,
    };
    const emailSubject =
      RESERVATION_NOTIFICATION_MESSAGES.genericEventEmailSubject(eventType);
    const smsBody = RESERVATION_NOTIFICATION_MESSAGES.genericEventSmsBody({
      serviceName: input.serviceName,
      professionalName: input.professionalName,
      formattedDate,
      eventType,
    });

    await this.notificationsService.createInAppNotification({
      userId: input.clientId,
      type,
      title,
      body,
      data: communicationMetadata,
    });

    const createdRecords =
      await this.reservationCommunicationsRepository.createReservationDispatches(
        {
          reservationId: input.reservationId,
          userId: input.clientId,
          email: client.email,
          phoneNumber: client.numeroTelephone,
          emailSubject,
          emailContent: body,
          smsContent: smsBody,
          metadata: communicationMetadata,
        },
      );

    if (client.email) {
      const emailResult = await this.deliveryService.sendEmail({
        to: client.email,
        subject: emailSubject,
        text: body,
      });
      if (createdRecords.emailDispatchId) {
        await this.updateDispatchResult(
          createdRecords.emailDispatchId,
          emailResult,
        );
      }
    }

    const smsResult = await this.deliveryService.sendSms({
      to: client.numeroTelephone,
      body: smsBody,
    });
    if (createdRecords.smsDispatchId) {
      await this.updateDispatchResult(createdRecords.smsDispatchId, smsResult);
    }
  }

  private async updateDispatchResult(
    dispatchId: string,
    result: DispatchResult,
  ): Promise<void> {
    await this.reservationCommunicationsRepository.updateDispatchResult({
      dispatchId,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      status: result.status,
      error: result.error,
    });
  }

  private async notifyProfessionalPriceAdjustmentResponse(
    input: ReservationProfessionalPriceAdjustmentNotificationInput,
    type: 'AJUSTEMENT_PRIX_ACCEPTE' | 'AJUSTEMENT_PRIX_REFUSE',
    title: string,
    body: string,
  ): Promise<void> {
    await this.notificationsService.createInAppNotification({
      userId: input.professionalUserId,
      type,
      title,
      body,
      data: {
        reservationId: input.reservationId,
        serviceName: input.serviceName,
        proposedPrice: input.proposedPrice,
      },
    });
  }
}
