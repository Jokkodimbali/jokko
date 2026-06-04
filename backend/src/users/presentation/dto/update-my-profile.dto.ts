import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  SENEGAL_PHONE_PATTERN,
  normalizeSenegalPhoneNumber,
} from '../../../auth/domain/validators/phone-number.validator';

export class UpdateMyProfileDto {
  @ApiPropertyOptional({
    description: API_DOCS.auth.userNameField,
    example: 'Moussa Diallo',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2, { message: VALIDATION_MESSAGES.NAME_MIN })
  @MaxLength(100, { message: VALIDATION_MESSAGES.NAME_MAX })
  name?: string;

  @ApiPropertyOptional({
    description: API_DOCS.users.emailField,
    example: 'moussa@example.com',
    format: 'email',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.EMAIL_INVALID })
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Numero de telephone senegalais',
    example: '+221770000000',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : normalizeSenegalPhoneNumber(trimmed);
  })
  @IsOptional()
  @IsString()
  @Matches(SENEGAL_PHONE_PATTERN, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: API_DOCS.users.physicalAddressField,
    example: 'Dakar, Senegal',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: VALIDATION_MESSAGES.ADDRESS_MAX })
  address?: string | null;

  @ApiPropertyOptional({
    description: API_DOCS.users.avatarUrlField,
    example: 'https://cdn.jokko.sn/avatars/user-123.png',
    format: 'uri',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: VALIDATION_MESSAGES.AVATAR_URL_INVALID },
  )
  avatarUrl?: string | null;
}
