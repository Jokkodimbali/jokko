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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

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

  refresh(data: RefreshTokenRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/refresh`, data)
      .pipe(map(unwrapApiResponse));
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

  logout(refreshToken: string): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.apiUrl}/logout`, { refreshToken })
      .pipe(map(() => undefined));
  }
}
