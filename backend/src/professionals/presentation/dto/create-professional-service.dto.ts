import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export enum ServicePriceType {
  FIXE = 'FIXE',
  NEGOCIABLE = 'NEGOCIABLE',
}

export enum ServiceTravelMode {
  PRESTATAIRE_SE_DEPLACE = 'PRESTATAIRE_SE_DEPLACE',
  CLIENT_SE_DEPLACE = 'CLIENT_SE_DEPLACE',
  TRANSPORT_COLIS = 'TRANSPORT_COLIS',
}

export class CreateProfessionalServiceDto {
  @ApiProperty({
    description: API_DOCS.professionals.categoryIdField,
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.CATEGORY_ID_FORMAT })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.CATEGORY_ID_REQUIRED })
  categoryId!: string;

  @ApiProperty({
    description: API_DOCS.professionals.serviceNameField,
    example: 'Creation site web',
    maxLength: 200,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.SERVICE_NAME_REQUIRED })
  @IsString()
  @MaxLength(200, { message: VALIDATION_MESSAGES.SERVICE_NAME_MAX })
  name!: string;

  @ApiProperty({
    description: API_DOCS.professionals.serviceDescriptionField,
    example: 'Je cree des sites web modernes et responsifs',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.SERVICE_DESCRIPTION_REQUIRED })
  @IsString()
  description!: string;

  @ApiProperty({
    description: API_DOCS.professionals.servicePriceField,
    example: 50000,
    minimum: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsNotEmpty()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SERVICE_PRICE_INVALID })
  @IsPositive({ message: VALIDATION_MESSAGES.SERVICE_PRICE_MUST_BE_POSITIVE })
  price!: number;

  @ApiProperty({
    description: API_DOCS.professionals.servicePriceTypeField,
    enum: ServicePriceType,
    example: ServicePriceType.FIXE,
  })
  @IsNotEmpty()
  @IsEnum(ServicePriceType, {
    message: VALIDATION_MESSAGES.SERVICE_PRICE_TYPE_INVALID,
  })
  priceType!: ServicePriceType;

  @ApiProperty({
    description: 'Mode de deplacement applique au service',
    enum: ServiceTravelMode,
    example: ServiceTravelMode.PRESTATAIRE_SE_DEPLACE,
    required: false,
  })
  @IsOptional()
  @IsEnum(ServiceTravelMode, {
    message: VALIDATION_MESSAGES.NON_WHITELISTED_FIELD,
  })
  travelMode?: ServiceTravelMode;

  @ApiProperty({
    description: 'Duree du motif de consultation en minutes',
    example: 15,
    required: false,
    minimum: 5,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  durationMinutes?: number;

  @ApiProperty({
    description: 'Pause entre deux rendez-vous en minutes',
    example: 5,
    required: false,
    minimum: 0,
    maximum: 240,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  pauseMinutes?: number;

  @ApiProperty({
    description:
      'Indique si le motif est obligatoire pour la prise de rendez-vous',
    example: true,
    required: false,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
