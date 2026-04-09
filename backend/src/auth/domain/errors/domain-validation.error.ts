export class DomainValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'DomainValidationError';
  }
}
