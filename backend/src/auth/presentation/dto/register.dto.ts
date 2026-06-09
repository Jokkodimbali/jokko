import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  SENEGAL_PHONE_PATTERN,
  normalizeSenegalPhoneNumber,
} from '../../domain/validators/phone-number.validator';

export class RegisterDto {
  @ApiProperty({
    description: API_DOCS.auth.phoneNumberField,
    example: '+221770000000',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSenegalPhoneNumber(value) : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @IsString()
  @Matches(SENEGAL_PHONE_PATTERN, {
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

  @ApiPropertyOptional({
    description: "Role de l'utilisateur",
    enum: ['CLIENT', 'PRESTATAIRE', 'MEDECIN'],
    example: 'CLIENT',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(CLIENT|PRESTATAIRE|MEDECIN)$/)
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN' = 'CLIENT';

  @ApiPropertyOptional({
    description: "Adresse physique de l'utilisateur",
    example: 'Dakar, Plateau, Rue 12',
    minLength: 5,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(5, 255)
  adresse = 'Adresse non renseignee';

  @ApiPropertyOptional({
    description: 'Specialite medicale selectionnee pendant l inscription medecin',
    example: 'Cardiologie',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  medicalSpecialty?: string;

  @ApiPropertyOptional({
    description: 'Expertises et actes medicaux declares pendant l inscription',
    example: ['Consultation generale', 'Suivi cardiologique'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(140, { each: true })
  medicalExpertises?: string[];

  @ApiPropertyOptional({
    description:
      'Noms des documents selectionnes pendant l inscription medecin',
    example: ['diplome-medecine.pdf'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  medicalDocumentNames?: string[];

  @ApiPropertyOptional({
    description:
      'Categories professionnelles selectionnees pendant l inscription',
    example: ['8f0a4f71-2b5c-4e53-8a1d-76f651de2533'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description:
      'Sous-categories professionnelles selectionnees pendant l inscription',
    example: ['4c54f8ec-3274-43ff-9b7a-e769f1c21c76'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subCategoryIds?: string[];
}
