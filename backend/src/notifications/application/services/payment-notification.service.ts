import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_NOTIFICATION_MESSAGES } from '../../../core/messages/payment-notification.messages';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../../../users/application/ports/users-repository.port';
import { NOTIFICATION_TYPES } from '../../domain/entities/notification.entity';
import {
  RESERVATION_COMMUNICATIONS_REPOSITORY_PORT,
  type ReservationCommunicationsRepositoryPort,
} from '../ports/reservation-communications-repository.port';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationsService } from './notifications.service';

export type PaymentEscrowConfirmedNotificationInput = {
  clientId: string;
  professionalUserId: string;
  reservationId: string;
  paymentId: string;
  serviceName: string;
  amount: number;
  escrowStatus: string;
};

@Injectable()
export class PaymentNotificationService {
  constructor(
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
    @Inject(RESERVATION_COMMUNICATIONS_REPOSITORY_PORT)
    private readonly reservationCommunicationsRepository: ReservationCommunicationsRepositoryPort,
    private readonly notificationsService: NotificationsService,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  async notifyEscrowConfirmed(
    input: PaymentEscrowConfirmedNotificationInput,
  ): Promise<void> {
    const client = await this.usersRepository.findMeById(input.clientId);
    const professional = await this.usersRepository.findMeById(
      input.professionalUserId,
    );

    await this.notificationsService.createManyInAppNotifications([
      {
        userId: input.clientId,
        type: NOTIFICATION_TYPES.PAIEMENT_CONFIRME,
        title: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_TITLE,
        body: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_BODY,
        data: {
          reservationId: input.reservationId,
          paymentId: input.paymentId,
          serviceName: input.serviceName,
          amount: input.amount,
          escrowStatus: input.escrowStatus,
        },
      },
      {
        userId: input.professionalUserId,
        type: NOTIFICATION_TYPES.PAIEMENT_CONFIRME,
        title:
          PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_TITLE,
        body: PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_BODY(
          input.serviceName,
        ),
        data: {
          reservationId: input.reservationId,
          paymentId: input.paymentId,
          clientId: input.clientId,
          amount: input.amount,
          escrowStatus: input.escrowStatus,
        },
      },
    ]);

    if (client) {
      await this.notifyExternalRecipient({
        reservationId: input.reservationId,
        userId: client.id,
        email: client.email,
        phoneNumber: client.numeroTelephone,
        title: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_TITLE,
        emailSubject:
          PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_EMAIL_SUBJECT,
        body: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_BODY,
        smsBody: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_SMS_BODY(
          input.serviceName,
        ),
        metadata: {
          reservationId: input.reservationId,
          paymentId: input.paymentId,
          serviceName: input.serviceName,
          amount: input.amount,
          escrowStatus: input.escrowStatus,
        },
      });
    }

    if (professional) {
      const professionalBody =
        PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_BODY(
          input.serviceName,
        );
      await this.notifyExternalRecipient({
        reservationId: input.reservationId,
        userId: professional.id,
        email: professional.email,
        phoneNumber: professional.numeroTelephone,
        title:
          PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_TITLE,
        emailSubject:
          PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_EMAIL_SUBJECT,
        body: professionalBody,
        smsBody:
          PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_SMS_BODY(
            input.serviceName,
          ),
        metadata: {
          reservationId: input.reservationId,
          paymentId: input.paymentId,
          clientId: input.clientId,
          amount: input.amount,
          escrowStatus: input.escrowStatus,
        },
      });
    }
  }

  private async notifyExternalRecipient(input: {
    reservationId: string;
    userId: string;
    email: string | null;
    phoneNumber: string | null;
    title: string;
    emailSubject: string;
    body: string;
    smsBody: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const createdRecords =
      await this.reservationCommunicationsRepository.createReservationDispatches(
        {
          reservationId: input.reservationId,
          userId: input.userId,
          email: input.email,
          phoneNumber: input.phoneNumber,
          emailSubject: input.emailSubject,
          emailContent: input.body,
          smsContent: input.phoneNumber ? input.smsBody : undefined,
          metadata: input.metadata,
        },
      );

    if (input.email) {
      const emailResult = await this.deliveryService.sendEmail({
        to: input.email,
        subject: input.emailSubject,
        text: input.body,
      });
      if (createdRecords.emailDispatchId) {
        await this.reservationCommunicationsRepository.updateDispatchResult({
          dispatchId: createdRecords.emailDispatchId,
          provider: emailResult.provider,
          providerMessageId: emailResult.providerMessageId,
          status: emailResult.status,
          error: emailResult.error,
        });
      }
    }

    if (input.phoneNumber) {
      const smsResult = await this.deliveryService.sendSms({
        to: input.phoneNumber,
        body: input.smsBody,
      });
      if (createdRecords.smsDispatchId) {
        await this.reservationCommunicationsRepository.updateDispatchResult({
          dispatchId: createdRecords.smsDispatchId,
          provider: smsResult.provider,
          providerMessageId: smsResult.providerMessageId,
          status: smsResult.status,
          error: smsResult.error,
        });
      }
    }
  }
}
