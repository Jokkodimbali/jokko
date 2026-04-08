export const VERIFICATEUR_BASE_PORT = Symbol('VERIFICATEUR_BASE_PORT');

export interface VerificateurBasePort {
  verifierConnexion(): Promise<boolean>;
}
