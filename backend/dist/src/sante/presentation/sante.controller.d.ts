import { EtatSanteDto, ObtenirEtatSanteUseCase } from '../application/obtenir-etat-sante.use-case';
export declare class SanteController {
    private readonly obtenirEtatSante;
    constructor(obtenirEtatSante: ObtenirEtatSanteUseCase);
    getEtatSante(): Promise<EtatSanteDto>;
}
