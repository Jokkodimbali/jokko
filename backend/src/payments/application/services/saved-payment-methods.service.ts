import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { appHttpException } from '../../../core/http/app-http.exception';

type SavedPaymentMethodType = 'CARD' | 'WAVE' | 'OTHER';
type SavePaymentMethodInput = {
  type: SavedPaymentMethodType;
  label?: string;
  cardNumber?: string;
  holderName?: string;
  expiryMonth?: number;
  expiryYear?: number;
  phoneNumber?: string;
};
type UpdateSavedPaymentMethodInput = Omit<SavePaymentMethodInput, 'type'>;

const SAVED_PAYMENT_METHOD_TYPE = {
  CARD: 'CARD',
  WAVE: 'WAVE',
  OTHER: 'OTHER',
} as const satisfies Record<string, SavedPaymentMethodType>;

type SavedPaymentMethodRow = {
  id: string;
  user_id: string;
  type: SavedPaymentMethodType;
  label: string | null;
  masked_value: string;
  holder_name: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
};

export type SavedPaymentMethodView = {
  id: string;
  type: SavedPaymentMethodType;
  label: string | null;
  maskedValue: string;
  holderName: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SavedPaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<SavedPaymentMethodView[]> {
    const rows = await this.prisma.$queryRaw<SavedPaymentMethodRow[]>`
      SELECT id, user_id, type, label, masked_value, holder_name, expiry_month, expiry_year, is_default, created_at, updated_at
      FROM saved_payment_methods
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
    `;
    return rows.map((row) => this.toView(row));
  }

  async create(
    userId: string,
    dto: SavePaymentMethodInput,
  ): Promise<SavedPaymentMethodView> {
    const normalized = this.normalizeCreate(dto);
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<SavedPaymentMethodRow[]>`
      INSERT INTO saved_payment_methods (
        id, user_id, type, label, masked_value, holder_name, expiry_month, expiry_year
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${normalized.type},
        ${normalized.label},
        ${normalized.maskedValue},
        ${normalized.holderName},
        ${normalized.expiryMonth},
        ${normalized.expiryYear}
      )
      RETURNING id, user_id, type, label, masked_value, holder_name, expiry_month, expiry_year, is_default, created_at, updated_at
    `;
    return this.toView(rows[0]);
  }

  async update(
    userId: string,
    methodId: string,
    dto: UpdateSavedPaymentMethodInput,
  ): Promise<SavedPaymentMethodView> {
    const existing = await this.findOwned(userId, methodId);
    const normalized = this.normalizeUpdate(existing, dto);
    const rows = await this.prisma.$queryRaw<SavedPaymentMethodRow[]>`
      UPDATE saved_payment_methods
      SET
        label = ${normalized.label},
        masked_value = ${normalized.maskedValue},
        holder_name = ${normalized.holderName},
        expiry_month = ${normalized.expiryMonth},
        expiry_year = ${normalized.expiryYear},
        updated_at = now()
      WHERE id = ${methodId}::uuid AND user_id = ${userId}::uuid
      RETURNING id, user_id, type, label, masked_value, holder_name, expiry_month, expiry_year, is_default, created_at, updated_at
    `;
    return this.toView(rows[0]);
  }

  async remove(userId: string, methodId: string): Promise<void> {
    await this.findOwned(userId, methodId);
    await this.prisma.$executeRaw`
      DELETE FROM saved_payment_methods
      WHERE id = ${methodId}::uuid AND user_id = ${userId}::uuid
    `;
  }

  private async findOwned(
    userId: string,
    methodId: string,
  ): Promise<SavedPaymentMethodRow> {
    const rows = await this.prisma.$queryRaw<SavedPaymentMethodRow[]>`
      SELECT id, user_id, type, label, masked_value, holder_name, expiry_month, expiry_year, is_default, created_at, updated_at
      FROM saved_payment_methods
      WHERE id = ${methodId}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `;
    if (!rows[0]) {
      throw appHttpException('PAYMENTS_NOT_FOUND');
    }
    return rows[0];
  }

  private normalizeCreate(dto: SavePaymentMethodInput) {
    if (dto.type === SAVED_PAYMENT_METHOD_TYPE.CARD) {
      return {
        type: dto.type,
        label: dto.label?.trim() || 'Carte de credit',
        maskedValue: this.maskCard(dto.cardNumber ?? ''),
        holderName: dto.holderName?.trim() || null,
        expiryMonth: dto.expiryMonth ?? null,
        expiryYear: dto.expiryYear ?? null,
      };
    }

    if (dto.type === SAVED_PAYMENT_METHOD_TYPE.WAVE) {
      return {
        type: dto.type,
        label: dto.label?.trim() || 'Wave',
        maskedValue: this.maskPhone(dto.phoneNumber ?? ''),
        holderName: null,
        expiryMonth: null,
        expiryYear: null,
      };
    }

    return {
      type: dto.type,
      label: dto.label?.trim() || 'Autre moyen',
      maskedValue: 'Moyen enregistre',
      holderName: null,
      expiryMonth: null,
      expiryYear: null,
    };
  }

  private normalizeUpdate(
    existing: SavedPaymentMethodRow,
    dto: UpdateSavedPaymentMethodInput,
  ) {
    const label = dto.label?.trim() || existing.label;
    const maskedValue =
      existing.type === SAVED_PAYMENT_METHOD_TYPE.CARD &&
      dto.cardNumber &&
      !dto.cardNumber.includes('*')
        ? this.maskCard(dto.cardNumber)
        : existing.type === SAVED_PAYMENT_METHOD_TYPE.WAVE &&
            dto.phoneNumber &&
            !dto.phoneNumber.includes('*')
          ? this.maskPhone(dto.phoneNumber)
          : existing.masked_value;

    return {
      label,
      maskedValue,
      holderName: dto.holderName?.trim() ?? existing.holder_name,
      expiryMonth: dto.expiryMonth ?? existing.expiry_month,
      expiryYear: dto.expiryYear ?? existing.expiry_year,
    };
  }

  private maskCard(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 8) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }
    return `**** **** **** ${digits.slice(-4)}`;
  }

  private maskPhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 8) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }
    return digits.replace(/(\d{2,3})(?=\d)/g, '$1 ').trim();
  }

  private toView(row: SavedPaymentMethodRow): SavedPaymentMethodView {
    return {
      id: row.id,
      type: row.type,
      label: row.label,
      maskedValue: row.masked_value,
      holderName: row.holder_name,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
