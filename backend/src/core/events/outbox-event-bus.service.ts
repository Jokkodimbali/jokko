import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { StatutEvenement } from '@prisma/client';
import type { DomaineEvent } from './domaine-event';
import type { DomaineEventBusPort } from './domaine-event-bus.port';

@Injectable()
export class OutboxEventBusService implements DomaineEventBusPort {
  private readonly logger = new Logger(OutboxEventBusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async publier(event: DomaineEvent): Promise<void> {
    await this.persistToOutbox(event);
    this.eventEmitter.emit(event.nom, event);
  }

  private async persistToOutbox(event: DomaineEvent): Promise<void> {
    try {
      await this.prisma.evenementOutbox.create({
        data: {
          typeEvenement: event.nom,
          payload: event.payload as object,
          correlationId: (event as { correlationId?: string }).correlationId,
          statut: 'EN_ATTENTE',
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Failed to persist event ${event.nom} to outbox: ${errorMessage}`,
      );
    }
  }

  async processPendingEvents(): Promise<number> {
    const pendingEvents = await this.findPendingEvents();
    if (pendingEvents.length === 0) return 0;

    let processed = 0;
    for (const event of pendingEvents) {
      const success = await this.processEvent(event);
      if (success) processed++;
    }
    return processed;
  }

  private async findPendingEvents() {
    return this.prisma.evenementOutbox.findMany({
      where: { statut: StatutEvenement.EN_ATTENTE },
      orderBy: { creeLe: 'asc' },
      take: 100,
    });
  }

  private async processEvent(event: {
    id: string;
    typeEvenement: string;
    creeLe: Date;
    payload: unknown;
    nbTentatives: number;
  }): Promise<boolean> {
    try {
      this.emitEvent(event);
      await this.markAsProcessed(event.id);
      return true;
    } catch (error) {
      await this.markAsFailed(event.id, event.nbTentatives, error);
      return false;
    }
  }

  private emitEvent(event: {
    typeEvenement: string;
    creeLe: Date;
    payload: unknown;
  }): void {
    this.eventEmitter.emit(event.typeEvenement, {
      nom: event.typeEvenement,
      dateOccurrence: event.creeLe,
      payload: event.payload,
    });
  }

  private async markAsProcessed(eventId: string): Promise<void> {
    await this.prisma.evenementOutbox.update({
      where: { id: eventId },
      data: { statut: StatutEvenement.TRAITE, traiteLe: new Date() },
    });
  }

  private async markAsFailed(
    eventId: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const newStatus =
      attempts >= 3 ? StatutEvenement.ECHEC : StatutEvenement.EN_ATTENTE;
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    await this.prisma.evenementOutbox.update({
      where: { id: eventId },
      data: {
        nbTentatives: attempts + 1,
        erreur: errorMessage,
        statut: newStatus,
      },
    });
  }
}
