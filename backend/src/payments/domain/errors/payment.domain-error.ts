import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class PaymentDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static invalidAmount(reason: string): PaymentDomainError {
    return new PaymentDomainError(
      'PAYMENT_INVALID_AMOUNT',
      domainMessage('PAYMENT_INVALID_AMOUNT', { reason }),
    );
  }

  static invalidReference(reason: string): PaymentDomainError {
    return new PaymentDomainError(
      'PAYMENT_INVALID_REFERENCE',
      domainMessage('PAYMENT_INVALID_REFERENCE', { reason }),
    );
  }

  static insufficientFunds(
    requested: number,
    available: number,
  ): PaymentDomainError {
    return new PaymentDomainError(
      'PAYMENT_INSUFFICIENT_FUNDS',
      domainMessage('PAYMENT_INSUFFICIENT_FUNDS', { requested, available }),
    );
  }

  static invalidMethod(method: string): ValidationError {
    return new ValidationError(
      'PAYMENT_INVALID_METHOD',
      domainMessage('PAYMENT_INVALID_METHOD', { method }),
    );
  }

  static alreadyProcessed(): ConflictError {
    return new ConflictError(
      'PAYMENT_ALREADY_PROCESSED',
      domainMessage('PAYMENT_ALREADY_PROCESSED'),
    );
  }

  static escrowAlreadyReleased(): ConflictError {
    return new ConflictError(
      'ESCROW_ALREADY_RELEASED',
      domainMessage('ESCROW_ALREADY_RELEASED'),
    );
  }

  static escrowAlreadyDisputed(): ConflictError {
    return new ConflictError(
      'ESCROW_ALREADY_DISPUTED',
      domainMessage('ESCROW_ALREADY_DISPUTED'),
    );
  }

  static withdrawalTooSoon(hoursRemaining: number): ValidationError {
    return new ValidationError(
      'WITHDRAWAL_TOO_SOON',
      domainMessage('WITHDRAWAL_TOO_SOON', { hoursRemaining }),
    );
  }

  static withdrawalAmountTooLow(
    minimum: number,
    requested: number,
  ): ValidationError {
    return new ValidationError(
      'WITHDRAWAL_AMOUNT_TOO_LOW',
      domainMessage('WITHDRAWAL_AMOUNT_TOO_LOW', { minimum, requested }),
    );
  }

  static withdrawalAmountTooHigh(
    maximum: number,
    requested: number,
  ): ValidationError {
    return new ValidationError(
      'WITHDRAWAL_AMOUNT_TOO_HIGH',
      domainMessage('WITHDRAWAL_AMOUNT_TOO_HIGH', { maximum, requested }),
    );
  }

  static paymentNotFound(paymentId: string): NotFoundError {
    return new NotFoundError(
      'PAYMENT_NOT_FOUND',
      domainMessage('PAYMENT_NOT_FOUND', { paymentId }),
    );
  }

  static escrowNotFound(paymentId: string): NotFoundError {
    return new NotFoundError(
      'ESCROW_NOT_FOUND',
      domainMessage('ESCROW_NOT_FOUND', { paymentId }),
    );
  }

  static gatewayError(details: string): ValidationError {
    return new ValidationError(
      'PAYMENT_GATEWAY_ERROR',
      domainMessage('PAYMENT_GATEWAY_ERROR', { details }),
    );
  }

  static unauthorizedAccess(paymentId: string): ValidationError {
    return new ValidationError(
      'PAYMENT_UNAUTHORIZED_ACCESS',
      `Vous n'êtes pas autorisé à accéder au paiement ${paymentId}`,
    );
  }

  static withdrawalNotFound(id: string): NotFoundError {
    return new NotFoundError(
      'WITHDRAWAL_NOT_FOUND',
      `Demande de retrait introuvable: ${id}`,
    );
  }

  static withdrawalAlreadyProcessed(status: string): ConflictError {
    return new ConflictError(
      'WITHDRAWAL_ALREADY_PROCESSED',
      `Cette demande de retrait a déjà été traitée (Statut: ${status})`,
    );
  }

  static invalidWebhookSignature(): ValidationError {
    return new ValidationError(
      'PAYMENT_INVALID_WEBHOOK_SIGNATURE',
      domainMessage('PAYMENT_INVALID_WEBHOOK_SIGNATURE'),
    );
  }
}
