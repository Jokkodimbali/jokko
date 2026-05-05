import { ValidatorFn, Validators } from '@angular/forms';

export const PHONE_NUMBER_PATTERN = '^\\+?[1-9]\\d{7,14}$';
export const OTP_CODE_PATTERN = '^[0-9]{6}$';

type AuthValidatorCatalog = {
  phoneNumber: ValidatorFn[];
  password: ValidatorFn[];
  otpCode: ValidatorFn[];
  name: ValidatorFn[];
  address: ValidatorFn[];
};

export const AUTH_VALIDATORS: AuthValidatorCatalog = {
  phoneNumber: [Validators.required, Validators.pattern(PHONE_NUMBER_PATTERN)],
  password: [Validators.required, Validators.minLength(8), Validators.maxLength(64)],
  otpCode: [
    Validators.required,
    Validators.minLength(6),
    Validators.maxLength(6),
    Validators.pattern(OTP_CODE_PATTERN),
  ],
  name: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
  address: [Validators.required, Validators.minLength(5), Validators.maxLength(255)],
};
