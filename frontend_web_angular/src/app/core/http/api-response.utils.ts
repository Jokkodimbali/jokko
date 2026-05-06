import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse, ApiResponse } from './api-response.models';

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.data === undefined) {
    throw new Error('API response data is missing.');
  }

  return response.data;
}

export function getHttpErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof HttpErrorResponse) {
    const apiError = error.error as Partial<ApiErrorResponse> | undefined;
    const message = apiError?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}
