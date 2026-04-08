import { IsString, Length, Matches } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class VerifyOtpDto {
  @IsString({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;

  @IsString({ message: VALIDATION_MESSAGES.OTP_CODE_REQUIRED })
  @Length(6, 6, { message: VALIDATION_MESSAGES.OTP_CODE_LENGTH })
  code!: string;
}
