import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsIn,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CreateProfessionalProfileDto {
  @ApiProperty({
    description: API_DOCS.professionals.bioField,
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
    description: API_DOCS.professionals.companyNameField,
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
    description: API_DOCS.professionals.cityField,
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

  @ApiProperty({
    description: API_DOCS.search.latitudeField,
    example: 14.7167,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  @Max(90, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  latitude?: number | null;

  @ApiProperty({
    description: API_DOCS.search.longitudeField,
    example: -17.4677,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  @Max(180, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  longitude?: number | null;

  @ApiProperty({
    description: 'Type de vehicule utilise pour les deplacements.',
    example: 'VOITURE',
    required: false,
    enum: ['MOTO_SCOOTER', 'VOITURE', 'CAMIONNETTE'],
  })
  @IsOptional()
  @IsIn(['MOTO_SCOOTER', 'VOITURE', 'CAMIONNETTE'])
  vehicleType?: 'MOTO_SCOOTER' | 'VOITURE' | 'CAMIONNETTE';
}
