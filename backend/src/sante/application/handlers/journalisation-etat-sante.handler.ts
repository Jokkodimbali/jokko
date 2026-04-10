import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EtatSanteVerifieEvent } from '../../domaine/events/etat-sante-verifie.event';

@Injectable()
export class JournalisationEtatSanteHandler {
  private readonly logger = new Logger(JournalisationEtatSanteHandler.name);

  @OnEvent('sante.etat-verifie')
  handle(event: EtatSanteVerifieEvent): void {
    if (
      event.payload.statut === 'erreur' ||
      event.payload.baseDeDonnees === 'deconnectee'
    ) {
      this.logger.error(
        `Etat de sante: ${event.payload.statut} (db: ${event.payload.baseDeDonnees})`,
      );
    }
  }
}
