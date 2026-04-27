import { PaymentAmount } from './payment-amount.vo';
import { TransactionReference } from './transaction-reference.vo';

describe('PaymentAmount', () => {
  describe('create', () => {
    it('should create a valid amount', () => {
      const amount = PaymentAmount.create(10000);
      expect(amount).toBeInstanceOf(PaymentAmount);
      expect(amount.getValue()).toBe(10000);
    });

    it('should round to 2 decimal places', () => {
      const amount = PaymentAmount.create(100.999);
      expect(amount.getValue()).toBe(101);
    });

    it('should throw error for negative amount', () => {
      expect(() => PaymentAmount.create(-100)).toThrow(
        'Montant invalide : Montant negatif non autorise',
      );
    });

    it('should throw error for amount too high', () => {
      expect(() => PaymentAmount.create(1000000)).toThrow(
        'Montant invalide : Montant trop eleve',
      );
    });

    it('should throw error for NaN', () => {
      expect(() => PaymentAmount.create('invalid')).toThrow(
        'Montant invalide : Valeur non numerique',
      );
    });
  });

  describe('operations', () => {
    let amount: PaymentAmount;

    beforeEach(() => {
      amount = PaymentAmount.create(10000);
    });

    it('should add amounts correctly', () => {
      const other = PaymentAmount.create(5000);
      const result = amount.add(other);
      expect(result.getValue()).toBe(15000);
    });

    it('should subtract amounts correctly', () => {
      const other = PaymentAmount.create(3000);
      const result = amount.subtract(other);
      expect(result.getValue()).toBe(7000);
    });

    it('should throw error for negative result', () => {
      const other = PaymentAmount.create(15000);
      expect(() => amount.subtract(other)).toThrow(
        'Montant invalide : Resultat negatif non autorise',
      );
    });

    it('should calculate percentage correctly', () => {
      const commission = amount.percentage(10);
      expect(commission.getValue()).toBe(1000);
    });
  });

  describe('comparisons', () => {
    const amount1 = PaymentAmount.create(10000);
    const amount2 = PaymentAmount.create(15000);
    const amount3 = PaymentAmount.create(10000);

    it('should compare amounts correctly', () => {
      expect(amount1.isGreaterThan(amount2)).toBe(false);
      expect(amount2.isGreaterThan(amount1)).toBe(true);
      expect(amount1.isLessThan(amount2)).toBe(true);
      expect(amount1.isEqualTo(amount3)).toBe(true);
    });
  });
});

describe('TransactionReference', () => {
  describe('create', () => {
    it('should create a valid reference', () => {
      const ref = TransactionReference.create('PAY_1234567890_ABC123');
      expect(ref).toBeInstanceOf(TransactionReference);
      expect(ref?.getValue()).toBe('PAY_1234567890_ABC123');
    });

    it('should return null for null input', () => {
      const ref = TransactionReference.create(null);
      expect(ref).toBeNull();
    });

    it('should throw error for reference too short', () => {
      expect(() => TransactionReference.create('ABC')).toThrow(
        'Reference invalide : Longueur invalide (10-100 caracteres)',
      );
    });

    it('should throw error for invalid characters', () => {
      expect(() => TransactionReference.create('PAY_123@invalid')).toThrow(
        'Reference invalide : Caracteres non autorises (uniquement lettres, chiffres, tirets et underscores)',
      );
    });
  });

  describe('generate', () => {
    it('should generate a unique reference', () => {
      const ref1 = TransactionReference.generate();
      const ref2 = TransactionReference.generate();

      expect(ref1).toBeInstanceOf(TransactionReference);
      expect(ref2).toBeInstanceOf(TransactionReference);
      expect(ref1.getValue()).not.toBe(ref2.getValue());
    });

    it('should use provided prefix', () => {
      const ref = TransactionReference.generate('WD');
      expect(ref.getValue()).toMatch(/^WD_/);
    });
  });
});
