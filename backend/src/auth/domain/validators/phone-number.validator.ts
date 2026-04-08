import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';

@Injectable()
export class PhoneNumberValidator {
  normalizeOrThrow(phoneNumber: string): string {
    const normalized = phoneNumber.trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(normalized)) {
      throw appHttpException('AUTH_PHONE_INVALID');
    }
    return normalized;
  }
}
