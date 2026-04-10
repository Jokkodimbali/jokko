import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.NAME_REQUIRED })
  @MinLength(2, { message: VALIDATION_MESSAGES.NAME_MIN })
  @MaxLength(100, { message: VALIDATION_MESSAGES.NAME_MAX })
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.EMAIL_INVALID })
  email?: string;

  @IsString({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  password!: string;
}
