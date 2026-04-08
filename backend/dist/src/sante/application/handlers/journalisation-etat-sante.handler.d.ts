import { EtatSanteVerifieEvent } from '../../domaine/events/etat-sante-verifie.event';
export declare class JournalisationEtatSanteHandler {
    private readonly logger;
    handle(event: EtatSanteVerifieEvent): void;
}
