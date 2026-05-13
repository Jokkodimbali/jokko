import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AuthResponseDto,
  UserDto,
  UserProfileDto,
} from '../../features/auth/domain/models/auth.models';

const CURRENT_USER_KEY = 'currentUser';
const ACCESS_TOKEN_KEY = 'accessToken';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly currentUserSignal = signal<UserDto | null>(
    this.readStoredUser(),
  );

  readonly currentUser = this.currentUserSignal.asReadonly();

  saveAuthResponse(response: AuthResponseDto): void {
    if (response.user) {
      this.saveUser(response.user);
    }
    // Save access token if available (for Authorization header)
    if ((response as any).accessToken) {
      this.saveAccessToken((response as any).accessToken);
    }
  }

  getAccessToken(): string | null {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  hasAuthenticatedSession(): boolean {
    return Boolean(this.currentUserSignal() && this.getAccessToken());
  }

  saveUserProfile(profile: UserProfileDto): void {
    this.saveUser({
      id: profile.id,
      phoneNumber: profile.numeroTelephone,
      name: profile.nom,
      email: profile.email ?? undefined,
      role: profile.role,
      avatarUrl: profile.urlAvatar ?? null,
    });
  }

  clear(): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
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

  private saveAccessToken(token: string): void {
    this.setItem(ACCESS_TOKEN_KEY, token);
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
