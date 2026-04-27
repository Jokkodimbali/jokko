import { DomainError } from '../../../shared/domain/errors/domain-error';

export class NegotiationDomainError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static amountInvalid(): NegotiationDomainError {
    return new NegotiationDomainError(
      'NEGOTIATIONS_AMOUNT_INVALID',
      'Le montant negocie doit etre strictement positif.',
    );
  }

  static wrongTurn(): NegotiationDomainError {
    return new NegotiationDomainError(
      'NEGOTIATIONS_WRONG_TURN',
      'Cette action nest pas autorisee pour le tour de negociation actuel.',
    );
  }

  static alreadyClosed(): NegotiationDomainError {
    return new NegotiationDomainError(
      'NEGOTIATIONS_ALREADY_CLOSED',
      'Cette negotiation est deja cloturee.',
    );
  }

  static acceptedRequired(): NegotiationDomainError {
    return new NegotiationDomainError(
      'NEGOTIATIONS_ACCEPTED_REQUIRED',
      'La negotiation doit etre acceptee avant de creer une reservation.',
    );
  }

  static alreadyConverted(): NegotiationDomainError {
    return new NegotiationDomainError(
      'NEGOTIATIONS_ALREADY_CONVERTED',
      'Cette negotiation est deja liee a une reservation.',
    );
  }
}
