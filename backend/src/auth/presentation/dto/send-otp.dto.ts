import { IsString, Matches } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class SendOtpDto {
  @IsString({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;
}
