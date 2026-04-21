import { Injectable } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { PAYMENT_NOTIFICATION_MESSAGES } from '../../../core/messages/payment-notification.messages';
import { PrismaService } from '../../../prisma/prisma.service';
import { type PaymentWorkflowPort } from '../../application/ports/payment-workflow.port';
import { type Payment } from '../../domain/entities/payment.entity';

@Injectable()
export class PaymentWorkflowRepository implements PaymentWorkflowPort {
  constructor(private readonly prisma: PrismaService) {}

  async markReservationAsPaidAndNotify(payment: Payment): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: payment.bookingId },
      include: {
        service: true,
        professionnel: { include: { utilisateur: true } },
        client: true,
      },
    });

    if (!reservation) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: payment.bookingId },
        data: { statut: StatutReservation.PAYEE_SEQUESTRE },
      });

      await tx.notification.createMany({
        data: [
          {
            utilisateurId: reservation.clientId,
            type: 'RESERVATION_CONFIRMEE',
            titre: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_TITLE,
            corps: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_BODY,
            donnees: {
              reservationId: reservation.id,
              paymentId: payment.id,
              serviceName: reservation.service.nom,
              amount: payment.amount.getValue(),
              escrowStatus: payment.escrowStatus,
            },
          },
          {
            utilisateurId: reservation.professionnel.utilisateurId,
            type: 'RESERVATION_CONFIRMEE',
            titre:
              PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_TITLE,
            corps:
              PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_BODY(
                reservation.service.nom,
              ),
            donnees: {
              reservationId: reservation.id,
              paymentId: payment.id,
              clientId: reservation.clientId,
              amount: payment.amount.getValue(),
              escrowStatus: payment.escrowStatus,
            },
          },
        ],
      });
    });
  }
}
