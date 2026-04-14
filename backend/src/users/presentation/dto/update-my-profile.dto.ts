import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class UpdateMyProfileDto {
  @ApiProperty({
    description: "Nom de l'utilisateur",
    example: 'Moussa Diallo',
    required: false,
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

  @ApiProperty({
    description: 'Adresse email',
    example: 'moussa@example.com',
    required: false,
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

  @ApiProperty({
    description: 'Adresse physique',
    example: 'Dakar, Senegal',
    required: false,
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: VALIDATION_MESSAGES.ADDRESS_MAX })
  address?: string | null;

  @ApiProperty({
    description: "URL de l'avatar",
    example: 'https://cdn.jokko.sn/avatars/user-123.png',
    required: false,
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
