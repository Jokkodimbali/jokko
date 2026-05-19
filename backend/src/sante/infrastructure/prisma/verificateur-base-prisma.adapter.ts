import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TECHNICAL_MESSAGES } from '../../../core/http/app-messages';
import { VerificateurBasePort } from '../../domaine/ports/verificateur-base.port';

@Injectable()
export class VerificateurBasePrismaAdapter implements VerificateurBasePort {
  private static readonly TIMEOUT_MS = 5000;

  constructor(private readonly prisma: PrismaService) {}

  async verifierConnexion(): Promise<boolean> {
    try {
      const resultat = await Promise.race([
        this.prisma.$queryRaw`SELECT 1::int AS ok`,
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(TECHNICAL_MESSAGES.DATABASE_HEALTH_TIMEOUT)),
            VerificateurBasePrismaAdapter.TIMEOUT_MS,
          );
        }),
      ]);
      return Boolean(resultat);
    } catch {
      return false;
    }
  }
}
