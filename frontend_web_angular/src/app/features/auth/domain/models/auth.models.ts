export interface LoginRequestDto {
  phoneNumber: string;
  password: string;
}

export interface RegisterRequestDto {
  phoneNumber: string;
  name: string;
  email?: string;
  password: string;
  role: 'CLIENT' | 'PRESTATAIRE';
  adresse: string;
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
}

export interface UserDto {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  role: 'CLIENT' | 'PRESTATAIRE' | 'ADMIN' | string;
}

export interface UserProfileDto {
  id: string;
  numeroTelephone: string;
  nom: string;
  email?: string | null;
  role: 'CLIENT' | 'PRESTATAIRE' | 'ADMIN' | string;
  urlAvatar?: string | null;
  estActif: boolean;
}
