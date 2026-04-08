export declare const VERIFICATEUR_BASE_PORT: unique symbol;
export interface VerificateurBasePort {
    verifierConnexion(): Promise<boolean>;
}
