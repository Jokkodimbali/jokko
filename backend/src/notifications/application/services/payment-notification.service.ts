import { Injectable } from '@nestjs/common';
import { PAYMENT_NOTIFICATION_MESSAGES } from '../../../core/messages/payment-notification.messages';
import { NOTIFICATION_TYPES } from '../../domain/entities/notification.entity';
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
  constructor(private readonly notificationsService: NotificationsService) {}

  async notifyEscrowConfirmed(
    input: PaymentEscrowConfirmedNotificationInput,
  ): Promise<void> {
    await this.notificationsService.createManyInAppNotifications([
      {
        userId: input.clientId,
        type: NOTIFICATION_TYPES.RESERVATION_CONFIRMEE,
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
        type: NOTIFICATION_TYPES.RESERVATION_CONFIRMEE,
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
  }
}
