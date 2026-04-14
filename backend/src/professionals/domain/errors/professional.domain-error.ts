import { ValidationError } from '../../../shared/domain/errors/domain-error';

export class ProfessionalDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
