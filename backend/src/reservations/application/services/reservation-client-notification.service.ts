import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CanalCommunication,
  StatutCommunication,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../../../users/application/ports/users-repository.port';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import { RESERVATION_NOTIFICATION_MESSAGES } from '../../../core/messages/reservation-notification.messages';
import { TECHNICAL_MESSAGES } from '../../../core/messages/technical-message.catalog';

type ReservationCreatedNotificationInput = {
  reservationId: string;
  clientId: string;
  serviceName: string;
  professionalName: string;
  dateHeure: Date;
  adresseClient: string;
};

type DispatchResult = {
  status: StatutCommunication;
  provider?: string;
  providerMessageId?: string | null;
  error?: string | null;
};

@Injectable()
export class ReservationClientNotificationService {
  private readonly logger = new Logger(
    ReservationClientNotificationService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
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
    } satisfies Prisma.JsonObject;

    const createdRecords = await this.prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          utilisateurId: input.clientId,
          type: 'NOUVELLE_RESERVATION',
          titre: title,
          corps: body,
          donnees: communicationMetadata,
        },
      });

      const emailDispatch = client.email
        ? await tx.communicationReservation.create({
            data: {
              reservationId: input.reservationId,
              utilisateurId: input.clientId,
              canal: CanalCommunication.EMAIL,
              destinataire: client.email,
              sujet: RESERVATION_NOTIFICATION_MESSAGES.createdEmailSubject,
              contenu: body,
              metadata: communicationMetadata,
            },
            select: { id: true },
          })
        : null;

      const smsDispatch = await tx.communicationReservation.create({
        data: {
          reservationId: input.reservationId,
          utilisateurId: input.clientId,
          canal: CanalCommunication.SMS,
          destinataire: client.numeroTelephone,
          sujet: null,
          contenu: smsBody,
          metadata: communicationMetadata,
        },
        select: { id: true },
      });

      return {
        emailDispatchId: emailDispatch?.id ?? null,
        smsDispatchId: smsDispatch.id,
      };
    });

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

      const emailResult = await this.sendEmail({
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

    const smsResult = await this.sendSms({
      to: client.numeroTelephone,
      body: smsBody,
    });
    await this.updateDispatchResult(createdRecords.smsDispatchId, smsResult);
  }

  private async sendEmail(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<DispatchResult> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const fromAddress = this.configService.get<string>('EMAIL_FROM_ADDRESS');
    const fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') ?? 'Jokko';

    if (!apiKey || !fromAddress) {
      this.logger.warn(
        TECHNICAL_MESSAGES.RESERVATION_EMAIL_PROVIDER_NOT_CONFIGURED,
      );
      return {
        status: StatutCommunication.CONFIGURATION_MANQUANTE,
        provider: 'resend',
        error:
          TECHNICAL_MESSAGES.RESERVATION_EMAIL_PROVIDER_CONFIGURATION_MISSING,
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress}>`,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          TECHNICAL_MESSAGES.RESERVATION_EMAIL_FAILED(errorText),
        );
        return {
          status: StatutCommunication.ECHEC,
          provider: 'resend',
          error: errorText,
        };
      }

      const responseBody = (await response.json()) as { id?: string };
      return {
        status: StatutCommunication.ENVOYE,
        provider: 'resend',
        providerMessageId: responseBody.id ?? null,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        TECHNICAL_MESSAGES.RESERVATION_EMAIL_FAILED(errorMessage),
      );
      return {
        status: StatutCommunication.ECHEC,
        provider: 'resend',
        error: errorMessage,
      };
    }
  }

  private async sendSms(input: {
    to: string;
    body: string;
  }): Promise<DispatchResult> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = this.configService.get<string>(
      'TWILIO_PHONE_NUMBER',
    );

    if (!accountSid || !authToken || !fromPhoneNumber) {
      this.logger.warn(
        TECHNICAL_MESSAGES.RESERVATION_SMS_PROVIDER_NOT_CONFIGURED,
      );
      return {
        status: StatutCommunication.CONFIGURATION_MANQUANTE,
        provider: 'twilio',
        error:
          TECHNICAL_MESSAGES.RESERVATION_SMS_PROVIDER_CONFIGURATION_MISSING,
      };
    }

    try {
      const payload = new URLSearchParams({
        To: input.to,
        From: fromPhoneNumber,
        Body: input.body,
      });
      const authorization = Buffer.from(`${accountSid}:${authToken}`).toString(
        'base64',
      );

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: payload,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(TECHNICAL_MESSAGES.RESERVATION_SMS_FAILED(errorText));
        return {
          status: StatutCommunication.ECHEC,
          provider: 'twilio',
          error: errorText,
        };
      }

      const responseBody = (await response.json()) as { sid?: string };
      return {
        status: StatutCommunication.ENVOYE,
        provider: 'twilio',
        providerMessageId: responseBody.sid ?? null,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        TECHNICAL_MESSAGES.RESERVATION_SMS_FAILED(errorMessage),
      );
      return {
        status: StatutCommunication.ECHEC,
        provider: 'twilio',
        error: errorMessage,
      };
    }
  }

  private async updateDispatchResult(
    dispatchId: string,
    result: DispatchResult,
  ): Promise<void> {
    await this.prisma.communicationReservation.update({
      where: { id: dispatchId },
      data: {
        fournisseur: result.provider,
        identifiantFournisseur: result.providerMessageId ?? null,
        statut: result.status,
        erreur: result.error ?? null,
        envoyeLe:
          result.status === StatutCommunication.ENVOYE ? new Date() : null,
      },
    });
  }
}
