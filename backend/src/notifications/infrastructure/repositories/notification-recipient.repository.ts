import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type NotificationRecipient,
  type NotificationRecipientRepositoryPort,
} from '../../application/ports/notification-recipient-repository.port';

@Injectable()
export class NotificationRecipientRepository implements NotificationRecipientRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<NotificationRecipient | null> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        jetonFcm: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      fcmToken: user.jetonFcm,
    };
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { jetonFcm: fcmToken },
    });
  }
}
