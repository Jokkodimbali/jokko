import { HttpException } from '@nestjs/common';
import {
  APP_MESSAGE_CATALOG,
  type AppMessageKey,
  type AppMessageDefinition,
} from './app-messages';

type ExceptionPayload = {
  message: string;
  errorCode: string;
  details?: unknown;
};

export function appMessage(key: AppMessageKey): AppMessageDefinition {
  const entry: AppMessageDefinition = APP_MESSAGE_CATALOG[key];
  return entry;
}

export function appHttpException(
  key: AppMessageKey,
  details?: unknown,
): HttpException {
  const entry: AppMessageDefinition = APP_MESSAGE_CATALOG[key];
  const payload: ExceptionPayload = {
    message: entry.message,
    errorCode: entry.code,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return new HttpException(payload, entry.httpStatus);
}
