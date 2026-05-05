import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthResponseDto } from '../../features/auth/domain/models/auth.models';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly platformId = inject(PLATFORM_ID);

  get accessToken(): string | null {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  saveAuthResponse(response: AuthResponseDto): void {
    this.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    this.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  }

  clear(): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private getItem(key: string): string | null {
    if (!this.canUseStorage()) {
      return null;
    }

    return localStorage.getItem(key);
  }

  private setItem(key: string, value: string): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.setItem(key, value);
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
