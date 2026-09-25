import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryMediaService } from './cloudinary-media.service';

const TELECONSULTATION_DOCUMENT_PREFIX = 'Document partagé :';

export type DeletedTeleconsultationDocument = {
  conversationId: string;
  messageId: string;
  recipientUserId: string;
};

@Injectable()
export class TeleconsultationDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryMedia: CloudinaryMediaService,
    private readonly realtimeEvents: EventEmitter2,
  ) {}

  async deleteOwnedDocument(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<DeletedTeleconsultationDocument> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: {
        id: true,
        expediteurId: true,
        contenu: true,
        urlMedia: true,
        conversation: {
          select: {
            id: true,
            clientId: true,
            prestataireId: true,
            reservation: { select: { typeConsultation: true } },
          },
        },
      },
    });

    if (!message) throw new NotFoundException('Document introuvable.');
    if (message.expediteurId !== userId) {
      throw new ForbiddenException(
        'Seule la personne qui a partagé ce document peut le supprimer.',
      );
    }
    if (
      message.conversation.reservation?.typeConsultation !==
        'TELECONSULTATION' ||
      !this.isSharedDocument(message.contenu, message.urlMedia)
    ) {
      throw new BadRequestException(
        "Ce message n'est pas un document de téléconsultation.",
      );
    }

    await this.cloudinaryMedia.deleteByUrl(message.urlMedia!);
    await this.deleteMessagesAndRefreshConversation(message.conversation.id, [
      message.id,
    ]);

    return {
      conversationId: message.conversation.id,
      messageId: message.id,
      recipientUserId:
        message.conversation.clientId === userId
          ? message.conversation.prestataireId
          : message.conversation.clientId,
    };
  }

  async deleteAllForReservation(reservationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { reservationId },
      select: {
        id: true,
        clientId: true,
        prestataireId: true,
        messages: {
          select: { id: true, urlMedia: true },
        },
      },
    });
    if (!conversation?.messages.length) return;

    await Promise.all(
      conversation.messages
        .filter(
          (message): message is { id: string; urlMedia: string } =>
            !!message.urlMedia,
        )
        .map(({ urlMedia }) => this.cloudinaryMedia.deleteByUrl(urlMedia)),
    );
    await this.deleteMessagesAndRefreshConversation(
      conversation.id,
      conversation.messages.map(({ id }) => id),
    );
    for (const { id: messageId } of conversation.messages) {
      this.realtimeEvents.emit('conversation.message.deleted', {
        conversationId: conversation.id,
        messageId,
        recipientUserIds: [conversation.clientId, conversation.prestataireId],
      });
    }
  }

  private isSharedDocument(
    content: string | null,
    mediaUrl: string | null,
  ): boolean {
    return (
      !!mediaUrl && !!content?.startsWith(TELECONSULTATION_DOCUMENT_PREFIX)
    );
  }

  private async deleteMessagesAndRefreshConversation(
    conversationId: string,
    messageIds: string[],
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.message.deleteMany({
        where: { conversationId, id: { in: messageIds } },
      });
      const latest = await transaction.message.findFirst({
        where: { conversationId },
        orderBy: { creeLe: 'desc' },
        select: { creeLe: true },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { dernierMessageLe: latest?.creeLe ?? null },
      });
    });
  }
}
