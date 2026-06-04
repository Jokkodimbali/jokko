import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AuthResponseDto,
  UserDto,
  UserProfileDto,
} from '../../features/auth/domain/models/auth.models';

const CURRENT_USER_KEY = 'currentUser';
const ACCESS_TOKEN_KEY = 'accessToken';
const AUTH_STORAGE_MODE_KEY = 'authStorageMode';
const REMEMBERED_LOGIN_IDENTIFIER_KEY = 'rememberedLoginIdentifier';
const REMEMBERED_LOGIN_PHONE_KEY = 'rememberedLoginPhoneNumber';

type AuthStorageMode = 'local' | 'session';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly currentUserSignal = signal<UserDto | null>(
    this.readStoredUser(),
  );

  readonly currentUser = this.currentUserSignal.asReadonly();

  saveAuthResponse(response: AuthResponseDto, rememberMe = true): void {
    const storage = this.getWritableStorage(rememberMe ? 'local' : 'session');
    if (!storage) {
      return;
    }

    this.clearAuthFromStorage(this.getOppositeStorage(rememberMe ? 'local' : 'session'));
    storage.setItem(AUTH_STORAGE_MODE_KEY, rememberMe ? 'local' : 'session');

    if (response.user) {
      this.saveUser(response.user, storage);
    }
    if (response.accessToken) {
      this.saveAccessToken(response.accessToken, storage);
    }
  }

  getAccessToken(): string | null {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  getAuthenticatedRole(): UserDto['role'] | null {
    return this.readTokenRole() ?? this.currentUserSignal()?.role ?? null;
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
      professionalProfile: profile.profilProfessionnel ?? null,
    });
  }

  isRememberMeEnabled(): boolean {
    if (!this.canUseStorage()) {
      return false;
    }

    return localStorage.getItem(AUTH_STORAGE_MODE_KEY) === 'local';
  }

  getRememberedLoginIdentifier(): string | null {
    if (!this.canUseStorage()) {
      return null;
    }

    return localStorage.getItem(REMEMBERED_LOGIN_IDENTIFIER_KEY)
      ?? localStorage.getItem(REMEMBERED_LOGIN_PHONE_KEY);
  }

  saveRememberedLoginIdentifier(identifier: string): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.setItem(REMEMBERED_LOGIN_IDENTIFIER_KEY, identifier);
    localStorage.removeItem(REMEMBERED_LOGIN_PHONE_KEY);
  }

  forgetRememberedLoginIdentifier(): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.removeItem(REMEMBERED_LOGIN_IDENTIFIER_KEY);
    localStorage.removeItem(REMEMBERED_LOGIN_PHONE_KEY);
  }

  clear(): void {
    if (!this.canUseStorage()) {
      return;
    }

    this.clearAuthFromStorage(localStorage);
    this.clearAuthFromStorage(sessionStorage);
    this.currentUserSignal.set(null);
  }

  private getItem(key: string): string | null {
    if (!this.canUseStorage()) {
      return null;
    }

    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }

  private saveUser(user: UserDto, storage = this.getCurrentStorage()): void {
    this.currentUserSignal.set(user);
    storage?.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  private saveAccessToken(token: string, storage = this.getCurrentStorage()): void {
    storage?.setItem(ACCESS_TOKEN_KEY, token);
  }

  private readStoredUser(): UserDto | null {
    const rawUser = this.getItem(CURRENT_USER_KEY);
    if (!rawUser) return null;

    try {
      return JSON.parse(rawUser) as UserDto;
    } catch {
      if (this.canUseStorage()) {
        localStorage.removeItem(CURRENT_USER_KEY);
        sessionStorage.removeItem(CURRENT_USER_KEY);
      }
      return null;
    }
  }

  private readTokenRole(): UserDto['role'] | null {
    const token = this.getAccessToken();
    if (!token || !this.canUseStorage()) {
      return null;
    }

    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    try {
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(
        normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
        '=',
      );
      const decoded = JSON.parse(window.atob(paddedPayload)) as { role?: unknown };
      return typeof decoded.role === 'string' ? decoded.role : null;
    } catch {
      return null;
    }
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getCurrentStorage(): Storage | null {
    return this.getWritableStorage(this.resolveStorageMode());
  }

  private getWritableStorage(mode: AuthStorageMode): Storage | null {
    if (!this.canUseStorage()) {
      return null;
    }

    return mode === 'local' ? localStorage : sessionStorage;
  }

  private getOppositeStorage(mode: AuthStorageMode): Storage | null {
    return this.getWritableStorage(mode === 'local' ? 'session' : 'local');
  }

  private resolveStorageMode(): AuthStorageMode {
    if (!this.canUseStorage()) {
      return 'local';
    }

    const storedMode = localStorage.getItem(AUTH_STORAGE_MODE_KEY)
      ?? sessionStorage.getItem(AUTH_STORAGE_MODE_KEY);

    if (storedMode === 'local' || storedMode === 'session') {
      return storedMode;
    }

    if (localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(CURRENT_USER_KEY)) {
      return 'local';
    }

    return 'session';
  }

  private clearAuthFromStorage(storage: Storage | null): void {
    if (!storage) {
      return;
    }

    storage.removeItem(CURRENT_USER_KEY);
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(AUTH_STORAGE_MODE_KEY);
  }
}
