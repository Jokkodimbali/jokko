import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

/** Notifies only the participants of the order attached to a delivery mission. */
@Injectable()
export class DeliveryOrderEventsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  @OnEvent('tracking.provider.assigned')
  @OnEvent('tracking.provider.started-trip')
  @OnEvent('tracking.provider.arrived')
  @OnEvent('tracking.service.started')
  @OnEvent('tracking.service.completed')
  async onMissionChanged(event: { payload: { reservationId: string } }): Promise<void> {
    const where = { reservationLivraisonId: event.payload.reservationId };
    const [pharmacy, material] = await Promise.all([
      this.prisma.commandePharmacie.findUnique({ where, select: { id: true, clientId: true, pharmacie: { select: { utilisateurId: true } } } }),
      this.prisma.commandeMateriel.findUnique({ where, select: { id: true, clientId: true, quincaillerie: { select: { utilisateurId: true } } } }),
    ]);
    const publish = (kind: 'PHARMACY' | 'MATERIAL', orderId: string, recipients: string[]) => {
      for (const userId of new Set(recipients)) this.events.emit('delivery-order.updated', { kind, orderId, userId });
    };
    if (pharmacy) publish('PHARMACY', pharmacy.id, [pharmacy.clientId, pharmacy.pharmacie.utilisateurId]);
    if (material) publish('MATERIAL', material.id, [material.clientId, material.quincaillerie.utilisateurId]);
  }
}
