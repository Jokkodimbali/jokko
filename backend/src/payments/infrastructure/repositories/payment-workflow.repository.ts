import { Inject, Injectable } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import {
  type PaymentReservationPaidWorkflowResult,
  type PaymentWorkflowPort,
} from '../../application/ports/payment-workflow.port';
import { type Payment } from '../../domain/entities/payment.entity';

@Injectable()
export class PaymentWorkflowRepository implements PaymentWorkflowPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
  ) {}

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

    await this.eventBus.publier({
      nom: 'reservations.updated',
      dateOccurrence: new Date(),
      payload: {
        reservationId: reservation.id,
        clientId: reservation.clientId,
        professionalId: reservation.professionnelId,
      },
    });

    return {
      reservationId: reservation.id,
      clientId: reservation.clientId,
      professionalUserId: reservation.professionnel.utilisateurId,
      serviceName: reservation.service.nom,
    };
  }
}
