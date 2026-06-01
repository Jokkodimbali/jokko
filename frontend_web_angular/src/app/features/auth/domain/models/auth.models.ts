export interface LoginRequestDto {
  phoneNumber: string;
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
}

export interface UserDto {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN' | 'ADMIN' | string;
  avatarUrl?: string | null;
  professionalProfile?: UserProfessionalProfileDto | null;
}

export interface UserProfessionalProfileDto {
  id: string;
  nomEntreprise?: string | null;
  categories: string[];
}

export interface UserProfileDto {
  id: string;
  numeroTelephone: string;
  nom: string;
  email?: string | null;
  adresse?: string | null;
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN' | 'ADMIN' | string;
  urlAvatar?: string | null;
  estActif: boolean;
  creeLe?: string | Date;
  profilProfessionnel?: UserProfessionalProfileDto | null;
}
