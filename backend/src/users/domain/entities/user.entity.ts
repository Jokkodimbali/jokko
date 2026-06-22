import {
  UserProfileUpdated,
  UserAvatarUpdated,
  UserAnonymized,
  UserDeactivated,
} from '../events/user.events';
import { UserDomainError } from '../errors/user.domain-error';

export type UserRole = 'PRESTATAIRE' | 'MEDECIN' | 'CLIENT' | 'ADMIN';

/**
 * Aggregate Root for the User bounded entity.
 * Encapsulates all invariants and publishes domain events on state changes.
 */
export class User {
  private constructor(
    private readonly _id: string,
    private readonly _phoneNumber: string,
    private _name: string,
    private _role: UserRole,
    private _email: string | null,
    private _address: string | null,
    private _avatarUrl: string | null,
    private _isActive: boolean,
    private readonly _creeLe: Date,
    private readonly domainEvents: (
      | UserProfileUpdated
      | UserAvatarUpdated
      | UserAnonymized
      | UserDeactivated
    )[] = [],
  ) {}

  // ─── Getters ───────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get phoneNumber(): string {
    return this._phoneNumber;
  }

  get name(): string {
    return this._name;
  }

  get role(): UserRole {
    return this._role;
  }

  get email(): string | null {
    return this._email;
  }

  get address(): string | null {
    return this._address;
  }

  get avatarUrl(): string | null {
    return this._avatarUrl;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get creeLe(): Date {
    return this._creeLe;
  }

  // ─── Business Rules / Invariants ──────────────────────────────────────────

  isClient(): boolean {
    return this._role === 'CLIENT';
  }

  isProfessional(): boolean {
    return this._role === 'PRESTATAIRE' || this._role === 'MEDECIN';
  }

  isAdmin(): boolean {
    return this._role === 'ADMIN';
  }

  canAccessAdminPanel(): boolean {
    return this._role === 'ADMIN';
  }

  canBookServices(): boolean {
    return (
      this._isActive &&
      (this._role === 'CLIENT' ||
        this._role === 'PRESTATAIRE' ||
        this._role === 'MEDECIN')
    );
  }

  canProvideServices(): boolean {
    return (
      this._isActive &&
      (this._role === 'PRESTATAIRE' || this._role === 'MEDECIN')
    );
  }

  private assertActive(): void {
    if (!this._isActive) {
      throw UserDomainError.userNotActive();
    }
  }

  // ─── Factory Methods ──────────────────────────────────────────────────────

  static reconstitute(data: {
    id: string;
    phoneNumber: string;
    name: string;
    role: UserRole;
    email: string | null;
    address: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    creeLe: Date;
  }): User {
    return new User(
      data.id,
      data.phoneNumber,
      data.name,
      data.role,
      data.email,
      data.address,
      data.avatarUrl,
      data.isActive,
      data.creeLe,
    );
  }

  // ─── Behavior Methods ─────────────────────────────────────────────────────

  updateProfile(
    name: string | undefined,
    email: string | null | undefined,
    address: string | null | undefined,
    avatarUrl: string | null | undefined,
  ): void {
    this.assertActive();

    const changes: {
      name?: string;
      email?: string | null;
      address?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw UserDomainError.invalidName(trimmed);
      }
      this._name = trimmed;
      changes.name = trimmed;
    }

    if (email !== undefined) {
      this._email = email;
      changes.email = email;
    }

    if (address !== undefined) {
      this._address = address;
      changes.address = address;
    }

    if (avatarUrl !== undefined) {
      this._avatarUrl = avatarUrl;
      changes.avatarUrl = avatarUrl;
    }

    if (Object.keys(changes).length > 0) {
      this.domainEvents.push(new UserProfileUpdated(this._id, changes));
    }
  }

  updateAvatar(avatarUrl: string): void {
    this.assertActive();
    this._avatarUrl = avatarUrl;
    this.domainEvents.push(new UserAvatarUpdated(this._id, avatarUrl));
  }

  anonymize(): void {
    this._name = 'Utilisateur supprime';
    this._email = null;
    this._address = null;
    this._avatarUrl = null;
    this._isActive = false;

    this.domainEvents.push(new UserAnonymized(this._id));
    this.domainEvents.push(new UserDeactivated(this._id));
  }

  deactivate(): void {
    if (!this._isActive) {
      throw UserDomainError.userAlreadyDeactivated();
    }
    this._isActive = false;
    this.domainEvents.push(new UserDeactivated(this._id));
  }

  // ─── Domain Events ────────────────────────────────────────────────────────

  getDomainEvents(): readonly (
    | UserProfileUpdated
    | UserAvatarUpdated
    | UserAnonymized
    | UserDeactivated
  )[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  toMeView(): {
    id: string;
    phoneNumber: string;
    name: string;
    email: string | null;
    address: string | null;
    role: UserRole;
    avatarUrl: string | null;
    isActive: boolean;
    creeLe: Date;
  } {
    return {
      id: this._id,
      phoneNumber: this._phoneNumber,
      name: this._name,
      email: this._email,
      address: this._address,
      role: this._role,
      avatarUrl: this._avatarUrl,
      isActive: this._isActive,
      creeLe: this._creeLe,
    };
  }

  toPublicProfile(): {
    id: string;
    phoneNumber: string;
    name: string;
    role: UserRole;
    email: string | null;
  } {
    return {
      id: this._id,
      phoneNumber: this._phoneNumber,
      name: this._name,
      role: this._role,
      email: this._email,
    };
  }
}
