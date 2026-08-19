export interface LoginRequestDto {
  identifier: string;
  password: string;
}

export interface RegisterRequestDto {
  phoneNumber: string;
  name: string;
  email?: string;
  password: string;
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN';
  adresse: string;
  medicalSpecialty?: string;
  medicalExpertises?: string[];
  medicalDocumentNames?: string[];
  categoryIds?: string[];
  subCategoryIds?: string[];
}

export interface SendOtpRequestDto {
  phoneNumber: string;
}

export interface VerifyOtpRequestDto {
  phoneNumber: string;
  code: string;
}

export interface RefreshTokenRequestDto {
  refreshToken?: string;
}

export interface GoogleLoginRequestDto {
  idToken: string;
}

export interface SendOtpResponseDto {
  expiresInSeconds: number;
}

export interface AuthResponseDto {
  user: UserDto;
  accessToken?: string;
  refreshToken?: string;
}

export interface UserDto {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  address?: string | null;
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN' | 'ADMIN' | string;
  avatarUrl?: string | null;
  professionalProfile?: UserProfessionalProfileDto | null;
}

export interface UserProfessionalProfileDto {
  id: string;
  biographie?: string | null;
  nomEntreprise?: string | null;
  urlBanniere?: string | null;
  statutKyc?: string | null;
  ville?: string | null;
  categories: string[];
  diplomesMedicaux?: UserMedicalCredentialDto[];
}

export interface UserMedicalCredentialDto {
  id: string;
  titre: string;
  etablissement: string;
  promotion?: string | null;
  numeroReference?: string | null;
  urlDocument?: string | null;
  statut: string;
  verifieLe?: string | Date | null;
}

export interface UserProfileDto {
  id: string;
  numeroTelephone: string;
  nom: string;
  email?: string | null;
  adresse?: string | null;
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN' | 'ADMIN' | string;
  urlAvatar?: string | null;
  hasPassword?: boolean;
  estActif: boolean;
  creeLe?: string | Date;
  profilProfessionnel?: UserProfessionalProfileDto | null;
}
