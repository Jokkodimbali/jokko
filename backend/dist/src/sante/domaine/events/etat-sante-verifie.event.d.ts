import type { DomaineEvent } from '../../../core/events/domaine-event';
export type EtatSanteVerifiePayload = {
    statut: 'ok' | 'erreur';
    baseDeDonnees: 'connectee' | 'deconnectee';
};
export declare class EtatSanteVerifieEvent implements DomaineEvent<EtatSanteVerifiePayload> {
    readonly payload: EtatSanteVerifiePayload;
    readonly nom = "sante.etat-verifie";
    readonly dateOccurrence: Date;
    constructor(payload: EtatSanteVerifiePayload);
}
