import {
  CategoryActivated,
  CategoryCreated,
  CategoryDisabled,
  CategoryUpdated,
} from '../events/category.events';

export type CategoryUserRole = 'CLIENT' | 'PRESTATAIRE' | 'ADMIN';

export class Category {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _iconUrl: string | null,
    private _sortOrder: number,
    private _commissionRate: number,
    private _isActive: boolean,
    private readonly domainEvents: (
      | CategoryCreated
      | CategoryUpdated
      | CategoryActivated
      | CategoryDisabled
    )[] = [],
  ) {}

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get iconUrl(): string | null {
    return this._iconUrl;
  }

  get sortOrder(): number {
    return this._sortOrder;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get commissionRate(): number {
    return this._commissionRate;
  }

  static create(data: {
    id: string;
    name: string;
    iconUrl: string | null;
    sortOrder: number;
    commissionRate: number;
  }): Category {
    const category = new Category(
      data.id,
      data.name,
      data.iconUrl,
      data.sortOrder,
      data.commissionRate,
      true,
    );

    category.domainEvents.push(
      new CategoryCreated(
        category.id,
        category.name,
        category.iconUrl,
        category.sortOrder,
      ),
    );

    return category;
  }

  static reconstitute(data: {
    id: string;
    name: string;
    iconUrl: string | null;
    sortOrder: number;
    commissionRate: number;
    isActive: boolean;
  }): Category {
    return new Category(
      data.id,
      data.name,
      data.iconUrl,
      data.sortOrder,
      data.commissionRate,
      data.isActive,
    );
  }

  updateDetails(data: {
    name?: string;
    iconUrl?: string | null;
    sortOrder?: number;
    commissionRate?: number;
  }): void {
    if (data.name !== undefined) {
      this._name = data.name;
    }

    if (data.iconUrl !== undefined) {
      this._iconUrl = data.iconUrl;
    }

    if (data.sortOrder !== undefined) {
      this._sortOrder = data.sortOrder;
    }

    if (data.commissionRate !== undefined) {
      this._commissionRate = data.commissionRate;
    }

    this.domainEvents.push(
      new CategoryUpdated(this._id, this._name, this._iconUrl, this._sortOrder),
    );
  }

  disable(): void {
    this._isActive = false;
    this.domainEvents.push(new CategoryDisabled(this._id));
  }

  activate(): void {
    this._isActive = true;
    this.domainEvents.push(new CategoryActivated(this._id));
  }

  getDomainEvents(): readonly (
    | CategoryCreated
    | CategoryUpdated
    | CategoryActivated
    | CategoryDisabled
  )[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  static isAdminRole(role: string): role is CategoryUserRole {
    return role === 'ADMIN';
  }
}
