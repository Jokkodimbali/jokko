import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { CoreModule } from '../core/core.module';
import { AuthModule } from '../auth/auth.module';
import {
  EMAIL_NOTIFICATION_SENDER_PORT,
  PUSH_NOTIFICATION_SENDER_PORT,
  SMS_NOTIFICATION_SENDER_PORT,
} from './application/ports/notification-delivery.port';
import { NOTIFICATION_RECIPIENT_REPOSITORY_PORT } from './application/ports/notification-recipient-repository.port';
import { NOTIFICATIONS_REPOSITORY_PORT } from './application/ports/notifications-repository.port';
import { RESERVATION_COMMUNICATIONS_REPOSITORY_PORT } from './application/ports/reservation-communications-repository.port';
import { NotificationDeliveryService } from './application/services/notification-delivery.service';
import { NotificationsService } from './application/services/notifications.service';
import { PaymentNotificationService } from './application/services/payment-notification.service';
import { ReservationClientNotificationService } from './application/services/reservation-client-notification.service';
import { FcmPushNotificationAdapter } from './infrastructure/adapters/fcm-push-notification.adapter';
import { ResendEmailNotificationAdapter } from './infrastructure/adapters/resend-email-notification.adapter';
import { TwilioSmsNotificationAdapter } from './infrastructure/adapters/twilio-sms-notification.adapter';
import { NotificationRecipientRepository } from './infrastructure/repositories/notification-recipient.repository';
import { NotificationsRepository } from './infrastructure/repositories/notifications.repository';
import { ReservationCommunicationsRepository } from './infrastructure/repositories/reservation-communications.repository';
import { NotificationsController } from './presentation/controllers/notifications.controller';

@Module({
  imports: [PrismaModule, UsersModule, CoreModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationRecipientRepository,
    ReservationCommunicationsRepository,
    ResendEmailNotificationAdapter,
    TwilioSmsNotificationAdapter,
    FcmPushNotificationAdapter,
    {
      provide: NOTIFICATIONS_REPOSITORY_PORT,
      useExisting: NotificationsRepository,
    },
    {
      provide: NOTIFICATION_RECIPIENT_REPOSITORY_PORT,
      useExisting: NotificationRecipientRepository,
    },
    {
      provide: RESERVATION_COMMUNICATIONS_REPOSITORY_PORT,
      useExisting: ReservationCommunicationsRepository,
    },
    {
      provide: EMAIL_NOTIFICATION_SENDER_PORT,
      useExisting: ResendEmailNotificationAdapter,
    },
    {
      provide: SMS_NOTIFICATION_SENDER_PORT,
      useExisting: TwilioSmsNotificationAdapter,
    },
    {
      provide: PUSH_NOTIFICATION_SENDER_PORT,
      useExisting: FcmPushNotificationAdapter,
    },
    NotificationDeliveryService,
    NotificationsService,
    PaymentNotificationService,
    ReservationClientNotificationService,
  ],
  exports: [
    NotificationsService,
    PaymentNotificationService,
    ReservationClientNotificationService,
  ],
})
export class NotificationsModule {}
