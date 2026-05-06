import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class RegisterDto {
  @ApiProperty({
    description: API_DOCS.auth.phoneNumberField,
    example: '+221770000000',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;

  @ApiProperty({
    description: API_DOCS.auth.userNameField,
    example: 'Moussa Diallo',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.NAME_REQUIRED })
  @IsString()
  @MinLength(2, { message: VALIDATION_MESSAGES.NAME_MIN })
  @MaxLength(100, { message: VALIDATION_MESSAGES.NAME_MAX })
  name!: string;

  @ApiPropertyOptional({
    description: API_DOCS.auth.optionalEmailField,
    example: 'moussa@example.com',
    format: 'email',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.EMAIL_INVALID })
  email?: string;

  @ApiProperty({
    description: API_DOCS.auth.passwordRangeField,
    example: 'MonMotDePasse123!',
    minLength: 8,
    maxLength: 64,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @IsString()
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  password!: string;

  @ApiProperty({
    description: 'Rôle de l\'utilisateur (CLIENT ou PRESTATAIRE)',
    enum: ['CLIENT', 'PRESTATAIRE'],
    example: 'CLIENT',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(CLIENT|PRESTATAIRE)$/)
  role!: 'CLIENT' | 'PRESTATAIRE';

  @ApiProperty({
    description: 'Adresse physique de l\'utilisateur',
    example: 'Dakar, Plateau, Rue 12',
    minLength: 5,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 255)
  adresse!: string;
}
