export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

export class ValidationError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class NotFoundError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
