import type { DomaineEvent } from '../../../core/events/domaine-event';

export type EtatSanteVerifiePayload = {
  statut: 'ok' | 'erreur';
  baseDeDonnees: 'connectee' | 'deconnectee';
};

export class EtatSanteVerifieEvent implements DomaineEvent<EtatSanteVerifiePayload> {
  readonly nom = 'sante.etat-verifie';
  readonly dateOccurrence = new Date();

  constructor(readonly payload: EtatSanteVerifiePayload) {}
}
