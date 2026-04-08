import type { DomaineEventBusPort } from '../../core/events/domaine-event-bus.port';
import type { VerificateurBasePort } from '../domaine/ports/verificateur-base.port';
export type EtatSanteDto = {
    statut: 'ok' | 'erreur';
    baseDeDonnees: 'connectee' | 'deconnectee';
};
export declare class ObtenirEtatSanteUseCase {
    private readonly verificateurBase;
    private readonly domaineEventBus;
    constructor(verificateurBase: VerificateurBasePort, domaineEventBus: DomaineEventBusPort);
    execute(): Promise<EtatSanteDto>;
}
