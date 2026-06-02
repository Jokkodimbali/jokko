import {
  type RoleUtilisateur,
  type StatutReservation,
  type TypePrix,
} from '@prisma/client';

export const USERS_REPOSITORY_PORT = Symbol('USERS_REPOSITORY_PORT');

export type UserMeView = {
  id: string;
  numeroTelephone: string;
  nom: string;
  email: string | null;
  adresse: string | null;
  role: RoleUtilisateur;
  urlAvatar: string | null;
  estActif: boolean;
  creeLe: Date;
  profilProfessionnel: {
    id: string;
    biographie: string | null;
    nomEntreprise: string | null;
    statutKyc: string;
    ville: string | null;
    categories: string[];
    diplomesMedicaux: Array<{
      id: string;
      titre: string;
      etablissement: string;
      promotion: string | null;
      numeroReference: string | null;
      urlDocument: string | null;
      statut: string;
      verifieLe: Date | null;
    }>;
  } | null;
};

export type AdminUserListItem = UserMeView & {
  nombreReservationsClient: number;
  nombreReservationsPrestataire: number;
};

export type AdminUserHistoryView = {
  user: UserMeView;
  reservationsAsClient: UserHistoryItem[];
  reservationsAsProfessional: UserHistoryItem[];
  paymentsAsClient: Array<{
    id: string;
    bookingId: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
  withdrawalsAsProfessional: Array<{
    id: string;
    amount: number;
    status: string;
    requestedAt: Date;
  }>;
  notificationsCount: number;
};

export type UserProfileUpdateInput = {
  nom?: string;
  email?: string | null;
  adresse?: string | null;
  urlAvatar?: string | null;
};

export type UserProfileUpdateResult =
  | { status: 'updated'; user: UserMeView }
  | { status: 'not_found' }
  | { status: 'email_conflict' };

export type UserHistoryItem = {
  id: string;
  statut: StatutReservation;
  dateHeure: Date;
  notes: string | null;
  creeLe: Date;
  service: {
    id: string;
    nom: string;
    prix: number;
    typePrix: TypePrix;
  };
};

export type UserMedicalCredentialView = {
  id: string;
  titre: string;
  etablissement: string;
  promotion: string | null;
  numeroReference: string | null;
  urlDocument: string | null;
  statut: string;
  verifieLe: Date | null;
};

export interface UsersRepositoryPort {
  findMeById(userId: string): Promise<UserMeView | null>;
  findByEmail(email: string): Promise<{ id: string } | null>;
  updateMeById(
    userId: string,
    data: UserProfileUpdateInput,
  ): Promise<UserProfileUpdateResult>;
  anonymizeAndRevokeById(
    userId: string,
    replacementPhoneNumber: string,
  ): Promise<UserMeView | null>;
  listClientHistory(userId: string, limit: number): Promise<UserHistoryItem[]>;
  listAdminUsers(query?: {
    role?: RoleUtilisateur;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminUserListItem[]>;
  findAdminUserById(userId: string): Promise<UserMeView | null>;
  setUserActiveStatus(
    userId: string,
    isActive: boolean,
  ): Promise<UserMeView | null>;
  getAdminUserHistory(
    userId: string,
    limit: number,
  ): Promise<AdminUserHistoryView | null>;
  countActiveUsers(): Promise<number>;
  findPasswordHashById(userId: string): Promise<string | null | undefined>;
  updatePasswordHashById(
    userId: string,
    passwordHash: string,
  ): Promise<boolean>;
  createProfessionalCredentialForUser(
    userId: string,
    data: {
      title: string;
      institution: string;
      graduationYear?: string | null;
      referenceNumber?: string | null;
      documentUrl: string;
    },
  ): Promise<
    | { status: 'created'; credential: UserMedicalCredentialView }
    | { status: 'professional_profile_not_found' }
  >;
  updateProfessionalBiographyForUser(
    userId: string,
    biography: string | null,
  ): Promise<UserMeView | null>;
  deleteProfessionalCredentialForUser(
    userId: string,
    credentialId: string,
  ): Promise<
    | { status: 'deleted'; user: UserMeView }
    | { status: 'credential_not_found' }
    | { status: 'professional_profile_not_found' }
  >;
}
