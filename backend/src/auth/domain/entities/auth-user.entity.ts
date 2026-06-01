import {
  AuthUserRegistered,
  AuthUserLoggedIn,
  AuthUserLoggedOut,
  AuthGoogleAccountLinked,
} from '../events/auth.events';

export type UserRole = 'PRESTATAIRE' | 'MEDECIN' | 'CLIENT' | 'ADMIN';

/**
 * Aggregate Root for authentication context.
 * Encapsulates auth rules and publishes domain events.
 */
export class AuthUser {
  private constructor(
    private readonly _id: string,
    private readonly _phoneNumber: string,
    private readonly _role: UserRole,
    private readonly _passwordHash: string | null,
    private _isActive: boolean,
    private readonly domainEvents: (
      | AuthUserRegistered
      | AuthUserLoggedIn
      | AuthUserLoggedOut
      | AuthGoogleAccountLinked
    )[] = [],
  ) {}

  // ─── Getters ───────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get phoneNumber(): string {
    return this._phoneNumber;
  }

  get role(): UserRole {
    return this._role;
  }

  get passwordHash(): string | null {
    return this._passwordHash;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // ─── Business Rules ────────────────────────────────────────────────────────

  hasPassword(): boolean {
    return this._passwordHash !== null;
  }

  isActiveUser(): boolean {
    return this._isActive;
  }

  isClient(): boolean {
    return this._role === 'CLIENT';
  }

  isProfessional(): boolean {
    return this._role === 'PRESTATAIRE' || this._role === 'MEDECIN';
  }

  isAdmin(): boolean {
    return this._role === 'ADMIN';
  }

  canAuthenticate(): boolean {
    return this._isActive && (this.hasPassword() || this.hasOAuthLinked());
  }

  private hasOAuthLinked(): boolean {
    // Would be true if user has linked OAuth account
    // For now, only password-based auth is tracked in this aggregate
    return false;
  }

  // ─── Factory ───────────────────────────────────────────────────────────────

  static reconstitute(data: {
    id: string;
    phoneNumber: string;
    role: UserRole;
    passwordHash: string | null;
    isActive: boolean;
  }): AuthUser {
    return new AuthUser(
      data.id,
      data.phoneNumber,
      data.role,
      data.passwordHash,
      data.isActive,
    );
  }

  static createNew(
    id: string,
    phoneNumber: string,
    name: string,
    passwordHash: string | null,
  ): AuthUser {
    const user = new AuthUser(id, phoneNumber, 'CLIENT', passwordHash, true);

    user.domainEvents.push(new AuthUserRegistered(id, phoneNumber, name));

    return user;
  }

  // ─── Behavior ──────────────────────────────────────────────────────────────

  recordLogin(): void {
    this.domainEvents.push(new AuthUserLoggedIn(this._id, this._phoneNumber));
  }

  recordLogout(): void {
    this.domainEvents.push(new AuthUserLoggedOut(this._id));
  }

  linkGoogleAccount(googleSub: string): void {
    this.domainEvents.push(new AuthGoogleAccountLinked(this._id, googleSub));
  }

  deactivate(): void {
    this._isActive = false;
  }

  // ─── Domain Events ────────────────────────────────────────────────────────

  getDomainEvents(): readonly (
    | AuthUserRegistered
    | AuthUserLoggedIn
    | AuthUserLoggedOut
    | AuthGoogleAccountLinked
  )[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  toSummary(): {
    id: string;
    phoneNumber: string;
    role: UserRole;
  } {
    return {
      id: this._id,
      phoneNumber: this._phoneNumber,
      role: this._role,
    };
  }

  toTokenPayload(): {
    sub: string;
    role: UserRole;
    phoneNumber: string;
  } {
    return {
      sub: this._id,
      role: this._role,
      phoneNumber: this._phoneNumber,
    };
  }
}
