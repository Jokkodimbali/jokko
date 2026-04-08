import { IsString, Length, Matches } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class LoginDto {
  @IsString({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;

  @IsString({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  password!: string;
}
