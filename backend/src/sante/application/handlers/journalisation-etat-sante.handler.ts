import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EtatSanteVerifieEvent } from '../../domaine/events/etat-sante-verifie.event';

@Injectable()
export class JournalisationEtatSanteHandler {
  private readonly logger = new Logger(JournalisationEtatSanteHandler.name);

  @OnEvent('sante.etat-verifie')
  handle(event: EtatSanteVerifieEvent): void {
    this.logger.log(
      `Etat de sante: ${event.payload.statut} (db: ${event.payload.baseDeDonnees})`,
    );
  }
}
