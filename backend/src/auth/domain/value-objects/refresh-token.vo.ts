import { randomUUID } from 'node:crypto';

export class RefreshToken {
  private readonly token: string;
  private readonly expiresAt: Date;
  private readonly userId: string;

  private constructor(token: string, expiresAt: Date, userId: string) {
    this.token = token;
    this.expiresAt = expiresAt;
    this.userId = userId;
  }

  static create(userId: string, ttlSeconds: number = 2592000): RefreshToken {
    return new RefreshToken(
      randomUUID(),
      new Date(Date.now() + ttlSeconds * 1000),
      userId,
    );
  }

  static fromExisting(
    token: string,
    expiresAt: Date,
    userId: string,
  ): RefreshToken {
    return new RefreshToken(token, expiresAt, userId);
  }

  getToken(): string {
    return this.token;
  }

  getUserId(): string {
    return this.userId;
  }

  getExpiresAt(): Date {
    return this.expiresAt;
  }

  isExpired(): boolean {
    return this.expiresAt.getTime() <= Date.now();
  }

  isValid(): boolean {
    return !this.isExpired();
  }

  getTTL(): number {
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }
}
