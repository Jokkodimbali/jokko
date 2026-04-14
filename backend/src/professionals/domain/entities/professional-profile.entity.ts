import { RoleUtilisateur } from '@prisma/client';

export class ProfessionalProfile {
  static isProfessionalRole(role: RoleUtilisateur): boolean {
    return role === RoleUtilisateur.PRESTATAIRE;
  }
}
