import { Injectable } from '@nestjs/common';
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
  utilisateurId: string;
  type: string;
  libelle: string | null;
  valeurMasquee: string;
  titulaire: string | null;
  moisExpiration: number | null;
  anneeExpiration: number | null;
  estDefaut: boolean;
  creeLe: Date;
  misAJourLe: Date;
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
    const rows = await this.prisma.moyenPaiementEnregistre.findMany({
      where: { utilisateurId: userId },
      orderBy: { creeLe: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    userId: string,
    dto: SavePaymentMethodInput,
  ): Promise<SavedPaymentMethodView> {
    const normalized = this.normalizeCreate(dto);
    const row = await this.prisma.moyenPaiementEnregistre.create({
      data: {
        utilisateurId: userId,
        type: normalized.type,
        libelle: normalized.label,
        valeurMasquee: normalized.maskedValue,
        titulaire: normalized.holderName,
        moisExpiration: normalized.expiryMonth,
        anneeExpiration: normalized.expiryYear,
      },
    });
    return this.toView(row);
  }

  async update(
    userId: string,
    methodId: string,
    dto: UpdateSavedPaymentMethodInput,
  ): Promise<SavedPaymentMethodView> {
    const existing = await this.findOwned(userId, methodId);
    const normalized = this.normalizeUpdate(existing, dto);
    const row = await this.prisma.moyenPaiementEnregistre.update({
      where: { id: methodId },
      data: {
        libelle: normalized.label,
        valeurMasquee: normalized.maskedValue,
        titulaire: normalized.holderName,
        moisExpiration: normalized.expiryMonth,
        anneeExpiration: normalized.expiryYear,
      },
    });
    return this.toView(row);
  }

  async remove(userId: string, methodId: string): Promise<void> {
    await this.findOwned(userId, methodId);
    await this.prisma.moyenPaiementEnregistre.delete({
      where: { id: methodId },
    });
  }

  private async findOwned(
    userId: string,
    methodId: string,
  ): Promise<SavedPaymentMethodRow> {
    const row = await this.prisma.moyenPaiementEnregistre.findFirst({
      where: { id: methodId, utilisateurId: userId },
    });
    if (!row) {
      throw appHttpException('PAYMENTS_NOT_FOUND');
    }
    return row;
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
    const label = dto.label?.trim() || existing.libelle;
    const maskedValue =
      existing.type === SAVED_PAYMENT_METHOD_TYPE.CARD &&
      dto.cardNumber &&
      !dto.cardNumber.includes('*')
        ? this.maskCard(dto.cardNumber)
        : existing.type === SAVED_PAYMENT_METHOD_TYPE.WAVE &&
            dto.phoneNumber &&
            !dto.phoneNumber.includes('*')
          ? this.maskPhone(dto.phoneNumber)
          : existing.valeurMasquee;

    return {
      label,
      maskedValue,
      holderName: dto.holderName?.trim() ?? existing.titulaire,
      expiryMonth: dto.expiryMonth ?? existing.moisExpiration,
      expiryYear: dto.expiryYear ?? existing.anneeExpiration,
    };
  }

  private maskCard(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!this.isValidSupportedCardNumber(digits)) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }
    return `**** **** **** ${digits.slice(-4)}`;
  }

  private isValidSupportedCardNumber(digits: string): boolean {
    if (
      digits.length < 13 ||
      digits.length > 19 ||
      !this.isValidCardNumber(digits)
    ) {
      return false;
    }
    if (digits.startsWith('4')) {
      return (
        digits.length === 13 || digits.length === 16 || digits.length === 19
      );
    }
    return true;
  }

  private isValidCardNumber(digits: string): boolean {
    let sum = 0;
    let shouldDouble = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
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
      type: this.toSavedPaymentMethodType(row.type),
      label: row.libelle,
      maskedValue: row.valeurMasquee,
      holderName: row.titulaire,
      expiryMonth: row.moisExpiration,
      expiryYear: row.anneeExpiration,
      isDefault: row.estDefaut,
      createdAt: row.creeLe,
      updatedAt: row.misAJourLe,
    };
  }

  private toSavedPaymentMethodType(value: string): SavedPaymentMethodType {
    if (value === SAVED_PAYMENT_METHOD_TYPE.CARD)
      return SAVED_PAYMENT_METHOD_TYPE.CARD;
    if (value === SAVED_PAYMENT_METHOD_TYPE.WAVE)
      return SAVED_PAYMENT_METHOD_TYPE.WAVE;
    return SAVED_PAYMENT_METHOD_TYPE.OTHER;
  }
}
