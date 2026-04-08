import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VerificateurBasePort } from '../../domaine/ports/verificateur-base.port';

@Injectable()
export class VerificateurBasePrismaAdapter implements VerificateurBasePort {
  constructor(private readonly prisma: PrismaService) {}

  async verifierConnexion(): Promise<boolean> {
    try {
      const resultat = await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database health timeout')), 1500);
        }),
      ]);
      return Boolean(resultat);
    } catch {
      return false;
    }
  }
}
