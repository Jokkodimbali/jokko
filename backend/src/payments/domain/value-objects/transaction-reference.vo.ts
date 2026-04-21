import { PaymentDomainError } from '../errors/payment.domain-error';

export class TransactionReference {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): TransactionReference | null {
    if (!raw) {
      return null;
    }

    const normalized = raw.trim();

    if (normalized.length < 10 || normalized.length > 100) {
      throw PaymentDomainError.invalidReference(
        'Longueur invalide (10-100 caractères)',
      );
    }

    const validPattern = /^[A-Za-z0-9_-]+$/;
    if (!validPattern.test(normalized)) {
      throw PaymentDomainError.invalidReference(
        'Caractères non autorisés (uniquement lettres, chiffres, tirets et underscores)',
      );
    }

    return new TransactionReference(normalized);
  }

  static generate(prefix: string = 'TXN'): TransactionReference {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `${prefix}_${timestamp}_${random}`;
    return new TransactionReference(reference);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TransactionReference): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
