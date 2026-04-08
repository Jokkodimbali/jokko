import { Module } from '@nestjs/common';
import { ObtenirEtatSanteUseCase } from './application/obtenir-etat-sante.use-case';
import { JournalisationEtatSanteHandler } from './application/handlers/journalisation-etat-sante.handler';
import { VERIFICATEUR_BASE_PORT } from './domaine/ports/verificateur-base.port';
import { VerificateurBasePrismaAdapter } from './infrastructure/prisma/verificateur-base-prisma.adapter';
import { SanteController } from './presentation/sante.controller';

@Module({
  controllers: [SanteController],
  providers: [
    ObtenirEtatSanteUseCase,
    JournalisationEtatSanteHandler,
    {
      provide: VERIFICATEUR_BASE_PORT,
      useClass: VerificateurBasePrismaAdapter,
    },
  ],
})
export class SanteModule {}
