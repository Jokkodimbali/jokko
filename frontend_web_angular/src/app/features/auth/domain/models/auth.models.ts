export interface LoginRequestDto {
  phoneNumber: string;
  password?: string;
}

export interface RegisterRequestDto {
  phoneNumber: string;
  name: string;
  email?: string;
  password?: string;
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

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface UserDto {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  roles: string[];
}
