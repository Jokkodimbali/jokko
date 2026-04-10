import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class UpdateMyProfileDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.NAME_REQUIRED })
  @MinLength(2, { message: VALIDATION_MESSAGES.NAME_MIN })
  @MaxLength(100, { message: VALIDATION_MESSAGES.NAME_MAX })
  name?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.EMAIL_INVALID })
  email?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.ADDRESS_INVALID })
  @MaxLength(255, { message: VALIDATION_MESSAGES.ADDRESS_MAX })
  address?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.AVATAR_URL_INVALID })
  @IsUrl({}, { message: VALIDATION_MESSAGES.AVATAR_URL_INVALID })
  avatarUrl?: string | null;
}
