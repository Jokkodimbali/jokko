import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class CreateProfessionalProfileDto {
  @ApiProperty({
    description: 'Biographie du professionnel',
    example: 'Developpeur web avec 5 ans d experience',
    required: false,
    maxLength: 1000,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: VALIDATION_MESSAGES.BIO_MAX })
  bio?: string | null;

  @ApiProperty({
    description: "Nom de l'entreprise",
    example: 'Tech Solutions SARL',
    required: false,
    maxLength: 150,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: VALIDATION_MESSAGES.COMPANY_NAME_MAX })
  companyName?: string | null;

  @ApiProperty({
    description: 'Ville du professionnel',
    example: 'Dakar',
    required: false,
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: VALIDATION_MESSAGES.CITY_MAX })
  city?: string | null;
}
