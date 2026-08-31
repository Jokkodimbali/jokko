import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { ValidateNested } from 'class-validator';

export class PharmacyOrderMedicineItemDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty()
  @IsBoolean()
  isAvailable!: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100_000_000)
  price?: number;
}

export class CreatePharmacyOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  medicalReservationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  pharmacyId!: string;
}

export class InitiatePharmacyOrderPaymentDto {
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

export class ConfigurePharmacyDeliveryDto {
  @ApiProperty()
  @IsBoolean()
  deliveryRequested!: boolean;
}

export class ListNearbyPharmaciesDto {
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

export class ValidatePharmacyOrderDto {
  @ApiProperty({
    enum: ['EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_DISPONIBLE', 'INDISPONIBLE'],
  })
  @IsIn(['EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_DISPONIBLE', 'INDISPONIBLE'])
  status!: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pharmacyNote?: string;

  @ApiPropertyOptional({ type: [PharmacyOrderMedicineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PharmacyOrderMedicineItemDto)
  medicineItems?: PharmacyOrderMedicineItemDto[];
}
