import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { appMessage } from './app-http.exception';
import { VALIDATION_MESSAGES } from './app-messages';

function normalizeValidationMessage(message: string): string {
  if (message.includes('should not exist')) {
    return VALIDATION_MESSAGES.NON_WHITELISTED_FIELD;
  }

  return message;
}

function flattenValidationErrors(
  errors: ValidationError[],
  accumulator: string[],
): void {
  for (const error of errors) {
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        accumulator.push(normalizeValidationMessage(message));
      }
    }

    if (error.children?.length) {
      flattenValidationErrors(error.children, accumulator);
    }
  }
}

export function buildValidationException(
  errors: ValidationError[],
): BadRequestException {
  const validationEntry = appMessage('VALIDATION_REQUEST_INVALID');
  const messages: string[] = [];
  flattenValidationErrors(errors, messages);

  return new BadRequestException({
    message: messages.length > 0 ? messages : [validationEntry.message],
    errorCode: validationEntry.code,
  });
}
