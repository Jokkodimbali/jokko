import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  LoginRequestDto, 
  RegisterRequestDto,
  SendOtpRequestDto,
  VerifyOtpRequestDto,
  AuthResponseDto 
} from '../domain/models/auth.models';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  login(credentials: LoginRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.apiUrl}/login`, credentials);
  }

  register(data: RegisterRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.apiUrl}/register`, data);
  }

  sendOtp(data: SendOtpRequestDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/otp/send`, data);
  }

  verifyOtp(data: VerifyOtpRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.apiUrl}/otp/verify`, data);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {});
  }
}
