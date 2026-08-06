import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CallHistoryView,
  CallsRepositoryPort,
  CallStatus,
} from '../application/ports/calls-repository.port';
import type { CallKind } from '../domain/call.types';
import { StatutAppel, TypeAppel } from '@prisma/client';

const statusToDb: Record<CallStatus, StatutAppel> = {
  RINGING: StatutAppel.SONNE,
  ACCEPTED: StatutAppel.ACCEPTE,
  REJECTED: StatutAppel.REFUSE,
  ENDED: StatutAppel.TERMINE,
  MISSED: StatutAppel.MANQUE,
  FAILED: StatutAppel.ECHEC,
};
const statusFromDb = Object.fromEntries(
  Object.entries(statusToDb).map(([key, value]) => [value, key]),
) as Record<StatutAppel, CallStatus>;

@Injectable()
export class CallsRepository implements CallsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}
  async create(input: {
    id: string;
    conversationId: string;
    callerId: string;
    recipientId: string;
    kind: CallKind;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.appel.create({
      data: {
        id: input.id,
        conversationId: input.conversationId,
        appelantId: input.callerId,
        destinataireId: input.recipientId,
        type: input.kind === 'VIDEO' ? TypeAppel.VIDEO : TypeAppel.VOCAL,
        expireLe: input.expiresAt,
      },
    });
  }
  async transition(input: {
    id: string;
    actorId: string;
    from: CallStatus[];
    to: CallStatus;
  }): Promise<boolean> {
    const terminalDate = new Date();
    // Raccrocher avant qu'un participant ait accepte est un appel manque.
    if (input.to === 'ENDED' && input.from.includes('RINGING')) {
      const missed = await this.prisma.appel.updateMany({
        where: {
          id: input.id,
          OR: [
            { appelantId: input.actorId },
            { destinataireId: input.actorId },
          ],
          statut: StatutAppel.SONNE,
        },
        data: { statut: StatutAppel.MANQUE, termineLe: terminalDate },
      });
      if (missed.count === 1) return true;
    }
    const remainingStatuses =
      input.to === 'ENDED'
        ? input.from.filter((item) => item !== 'RINGING')
        : input.from;
    if (remainingStatuses.length === 0) return false;
    const result = await this.prisma.appel.updateMany({
      where: {
        id: input.id,
        OR: [{ appelantId: input.actorId }, { destinataireId: input.actorId }],
        statut: { in: remainingStatuses.map((item) => statusToDb[item]) },
      },
      data: {
        statut: statusToDb[input.to],
        ...(input.to === 'ACCEPTED' ? { accepteLe: terminalDate } : {}),
        ...(['REJECTED', 'ENDED', 'MISSED', 'FAILED'].includes(input.to)
          ? { termineLe: terminalDate }
          : {}),
      },
    });
    return result.count === 1;
  }
  async listForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<CallHistoryView[]> {
    const calls = await this.prisma.appel.findMany({
      where: { OR: [{ appelantId: userId }, { destinataireId: userId }] },
      orderBy: { creeLe: 'desc' },
      take: limit,
      skip: offset,
      include: {
        appelant: { select: { id: true, nom: true, urlAvatar: true } },
        destinataire: { select: { id: true, nom: true, urlAvatar: true } },
      },
    });
    return calls.map((call) => {
      const outgoing = call.appelantId === userId;
      const counterpart = outgoing ? call.destinataire : call.appelant;
      return {
        id: call.id,
        conversationId: call.conversationId,
        kind: call.type === TypeAppel.VIDEO ? 'VIDEO' : 'VOICE',
        status: statusFromDb[call.statut],
        callerId: call.appelantId,
        recipientId: call.destinataireId,
        direction: outgoing ? 'OUTGOING' : 'INCOMING',
        counterpartName: counterpart.nom,
        counterpartAvatarUrl: counterpart.urlAvatar,
        startedAt: call.sonneLe,
        acceptedAt: call.accepteLe,
        endedAt: call.termineLe,
      };
    });
  }
  async expireRinging(now: Date) {
    const expired = await this.prisma.appel.findMany({
      where: { statut: StatutAppel.SONNE, expireLe: { lte: now } },
      select: {
        id: true,
        conversationId: true,
        appelantId: true,
        destinataireId: true,
        type: true,
      },
    });
    const result = [];
    for (const call of expired) {
      const updated = await this.prisma.appel.updateMany({
        where: { id: call.id, statut: StatutAppel.SONNE },
        data: { statut: StatutAppel.MANQUE, termineLe: now },
      });
      if (updated.count)
        result.push({
          id: call.id,
          conversationId: call.conversationId,
          callerId: call.appelantId,
          recipientId: call.destinataireId,
          kind:
            call.type === TypeAppel.VIDEO
              ? ('VIDEO' as const)
              : ('VOICE' as const),
        });
    }
    return result;
  }
}
