import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  GoogleLoginRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  SendOtpResponseDto,
  SendOtpRequestDto,
  VerifyOtpRequestDto,
  AuthResponseDto,
  UserProfileDto,
} from '../domain/models/auth.models';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

export type SavedPaymentMethodType = 'CARD' | 'WAVE' | 'OTHER';

export interface SavedPaymentMethodView {
  id: string;
  type: SavedPaymentMethodType;
  label: string | null;
  maskedValue: string;
  holderName: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly usersApiUrl = `${environment.apiUrl}/users`;
  private readonly paymentsApiUrl = `${environment.apiUrl}/payments`;

  login(credentials: LoginRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/login`, credentials)
      .pipe(map(unwrapApiResponse));
  }

  register(data: RegisterRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/register`, data)
      .pipe(map(unwrapApiResponse));
  }

  sendOtp(data: SendOtpRequestDto): Observable<SendOtpResponseDto> {
    return this.http
      .post<ApiResponse<SendOtpResponseDto>>(`${this.apiUrl}/otp/send`, data)
      .pipe(map(unwrapApiResponse));
  }

  verifyOtp(data: VerifyOtpRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/otp/verify`, data)
      .pipe(map(unwrapApiResponse));
  }

  refresh(data: RefreshTokenRequestDto = {}): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.apiUrl}/refresh`, data)
      .pipe(map(() => undefined));
  }

  googleLogin(data: GoogleLoginRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/google/login`, data)
      .pipe(map(unwrapApiResponse));
  }

  me(): Observable<UserProfileDto> {
    return this.http
      .get<ApiResponse<UserProfileDto>>(`${this.apiUrl}/me`)
      .pipe(map(unwrapApiResponse));
  }

  myUserProfile(): Observable<UserProfileDto> {
    return this.http
      .get<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me`)
      .pipe(map(unwrapApiResponse));
  }

  updateMyProfile(data: {
    name?: string;
    email?: string | null;
    address?: string | null;
    avatarUrl?: string | null;
  }): Observable<UserProfileDto> {
    return this.http
      .patch<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateMyAvatar(avatarUrl: string | null): Observable<UserProfileDto> {
    return this.http
      .post<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/avatar`, { avatarUrl })
      .pipe(map(unwrapApiResponse));
  }

  uploadMyAvatar(file: File): Observable<UserProfileDto> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http
      .post<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/avatar/upload`, formData)
      .pipe(map(unwrapApiResponse));
  }

  deleteMyAccount(): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.usersApiUrl}/me`)
      .pipe(map(() => undefined));
  }

  listSavedPaymentMethods(): Observable<SavedPaymentMethodView[]> {
    return this.http
      .get<ApiResponse<SavedPaymentMethodView[]>>(`${this.paymentsApiUrl}/methods/saved`)
      .pipe(map(unwrapApiResponse));
  }

  createSavedPaymentMethod(data: {
    type: SavedPaymentMethodType;
    label?: string;
    cardNumber?: string;
    holderName?: string;
    expiryMonth?: number;
    expiryYear?: number;
    phoneNumber?: string;
  }): Observable<SavedPaymentMethodView> {
    return this.http
      .post<ApiResponse<SavedPaymentMethodView>>(`${this.paymentsApiUrl}/methods/saved`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateSavedPaymentMethod(
    methodId: string,
    data: {
      label?: string;
      cardNumber?: string;
      holderName?: string;
      expiryMonth?: number;
      expiryYear?: number;
      phoneNumber?: string;
    },
  ): Observable<SavedPaymentMethodView> {
    return this.http
      .patch<ApiResponse<SavedPaymentMethodView>>(`${this.paymentsApiUrl}/methods/saved/${methodId}`, data)
      .pipe(map(unwrapApiResponse));
  }

  deleteSavedPaymentMethod(methodId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.paymentsApiUrl}/methods/saved/${methodId}`)
      .pipe(map(() => undefined));
  }

  logout(): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.apiUrl}/logout`, {})
      .pipe(map(() => undefined));
  }
}
