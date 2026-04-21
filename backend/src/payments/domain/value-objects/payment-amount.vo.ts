import { PaymentDomainError } from '../errors/payment.domain-error';

export class PaymentAmount {
  private constructor(private readonly value: number) {}

  static create(raw: number | string): PaymentAmount {
    const numericValue = typeof raw === 'string' ? Number.parseFloat(raw) : raw;

    if (Number.isNaN(numericValue)) {
      throw PaymentDomainError.invalidAmount('Valeur non numérique');
    }

    if (numericValue < 0) {
      throw PaymentDomainError.invalidAmount('Montant négatif non autorisé');
    }

    if (numericValue > 999999.99) {
      throw PaymentDomainError.invalidAmount('Montant trop élevé');
    }

    // Arrondir à 2 décimales
    const roundedValue = Math.round(numericValue * 100) / 100;

    return new PaymentAmount(roundedValue);
  }

  getValue(): number {
    return this.value;
  }

  add(other: PaymentAmount): PaymentAmount {
    return new PaymentAmount(this.value + other.value);
  }

  subtract(other: PaymentAmount): PaymentAmount {
    const result = this.value - other.value;
    if (result < 0) {
      throw PaymentDomainError.invalidAmount('Résultat négatif non autorisé');
    }
    return new PaymentAmount(result);
  }

  multiply(factor: number): PaymentAmount {
    return new PaymentAmount(this.value * factor);
  }

  divide(divisor: number): PaymentAmount {
    if (divisor === 0) {
      throw PaymentDomainError.invalidAmount('Division par zéro');
    }
    return new PaymentAmount(this.value / divisor);
  }

  percentage(percent: number): PaymentAmount {
    return new PaymentAmount((this.value * percent) / 100);
  }

  isGreaterThan(other: PaymentAmount): boolean {
    return this.value > other.value;
  }

  isLessThan(other: PaymentAmount): boolean {
    return this.value < other.value;
  }

  isEqualTo(other: PaymentAmount): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return `${this.value.toFixed(2)} FCFA`;
  }

  equals(other: PaymentAmount): boolean {
    return this.value === other.value;
  }
}
