import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateMaterialOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  reservationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  hardwareStoreId!: string;
}

export class NearbyHardwareStoresDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number;
}

export class MaterialAvailabilityItemDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty()
  @IsBoolean()
  isAvailable!: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100_000_000)
  unitPrice?: number;
}

export class ValidateMaterialOrderDto {
  @ApiProperty({
    enum: ['EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_DISPONIBLE', 'INDISPONIBLE'],
  })
  @IsIn(['EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_DISPONIBLE', 'INDISPONIBLE'])
  status!: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';

  @ApiPropertyOptional({ type: [MaterialAvailabilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialAvailabilityItemDto)
  items!: MaterialAvailabilityItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ConfigureMaterialDeliveryDto {
  @ApiProperty()
  @IsBoolean()
  deliveryRequested!: boolean;
}

export class InitiateMaterialOrderPaymentDto {
  @ApiProperty({ enum: ['WAVE', 'ORANGE_MONEY', 'CARD'] })
  @IsIn(['WAVE', 'ORANGE_MONEY', 'CARD'])
  method!: 'WAVE' | 'ORANGE_MONEY' | 'CARD';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  cancelUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  callbackUrl?: string;
}
