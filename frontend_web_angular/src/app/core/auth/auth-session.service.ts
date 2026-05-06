import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AuthResponseDto,
  UserDto,
  UserProfileDto,
} from '../../features/auth/domain/models/auth.models';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const CURRENT_USER_KEY = 'currentUser';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly currentUserSignal = signal<UserDto | null>(
    this.readStoredUser(),
  );

  readonly currentUser = this.currentUserSignal.asReadonly();

  get accessToken(): string | null {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  saveAuthResponse(response: AuthResponseDto): void {
    this.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    this.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    if (response.user) {
      this.saveUser(response.user);
    }
  }

  saveUserProfile(profile: UserProfileDto): void {
    this.saveUser({
      id: profile.id,
      phoneNumber: profile.numeroTelephone,
      name: profile.nom,
      email: profile.email ?? undefined,
      role: profile.role,
    });
  }

  clear(): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    this.currentUserSignal.set(null);
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

  private saveUser(user: UserDto): void {
    this.currentUserSignal.set(user);
    this.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  private readStoredUser(): UserDto | null {
    const rawUser = this.getItem(CURRENT_USER_KEY);
    if (!rawUser) return null;

    try {
      return JSON.parse(rawUser) as UserDto;
    } catch {
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
