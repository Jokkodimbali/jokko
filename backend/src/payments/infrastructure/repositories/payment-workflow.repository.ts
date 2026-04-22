import { Injectable } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type PaymentReservationPaidWorkflowResult,
  type PaymentWorkflowPort,
} from '../../application/ports/payment-workflow.port';
import { type Payment } from '../../domain/entities/payment.entity';

@Injectable()
export class PaymentWorkflowRepository implements PaymentWorkflowPort {
  constructor(private readonly prisma: PrismaService) {}

  async markReservationAsPaid(
    payment: Payment,
  ): Promise<PaymentReservationPaidWorkflowResult | null> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: payment.bookingId },
      include: {
        service: true,
        professionnel: { include: { utilisateur: true } },
        client: true,
      },
    });

    if (!reservation) {
      return null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: payment.bookingId },
        data: { statut: StatutReservation.PAYEE_SEQUESTRE },
      });
    });

    return {
      reservationId: reservation.id,
      clientId: reservation.clientId,
      professionalUserId: reservation.professionnel.utilisateurId,
      serviceName: reservation.service.nom,
    };
  }
}
