import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogData } from './audit.types';

type JournalAuditList = Awaited<
  ReturnType<PrismaService['journalAudit']['findMany']>
>;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: data.utilisateurId,
          nomUtilisateur: data.nomUtilisateur,
          typeAction: data.typeAction,
          description: data.description,
          entiteType: data.entiteType,
          entiteId: data.entiteId,
          adresseIp: data.adresseIp,
          userAgent: data.userAgent,
          latitude: data.latitude,
          longitude: data.longitude,
          localisationTexte: data.localisationTexte,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`Failed to write audit log: ${errorMessage}`);
    }
  }

  async findByUser(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<JournalAuditList> {
    return this.prisma.journalAudit.findMany({
      where: { utilisateurId: userId },
      orderBy: { creeLe: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
  }
}
