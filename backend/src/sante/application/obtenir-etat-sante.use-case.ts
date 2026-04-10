import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../core/events/domaine-event-bus.port';
import {
  VERIFICATEUR_BASE_PORT,
  type VerificateurBasePort,
} from '../domaine/ports/verificateur-base.port';
import { EtatSanteVerifieEvent } from '../domaine/events/etat-sante-verifie.event';

export type EtatSanteDto = {
  statut: 'ok' | 'erreur';
  baseDeDonnees: 'connectee' | 'deconnectee';
};

@Injectable()
export class ObtenirEtatSanteUseCase {
  constructor(
    @Inject(VERIFICATEUR_BASE_PORT)
    private readonly verificateurBase: VerificateurBasePort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly domaineEventBus: DomaineEventBusPort,
  ) {}

  async execute(): Promise<EtatSanteDto> {
    const connectee = await this.verificateurBase.verifierConnexion();
    const etat: EtatSanteDto = connectee
      ? { statut: 'ok', baseDeDonnees: 'connectee' }
      : { statut: 'erreur', baseDeDonnees: 'deconnectee' };

    await this.domaineEventBus.publier(new EtatSanteVerifieEvent(etat));
    return etat;
  }
}
