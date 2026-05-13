import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum SavedPaymentMethodType {
  CARD = 'CARD',
  WAVE = 'WAVE',
  OTHER = 'OTHER',
}

export class SavePaymentMethodDto {
  @ApiProperty({
    enum: SavedPaymentMethodType,
    example: SavedPaymentMethodType.WAVE,
  })
  @IsEnum(SavedPaymentMethodType)
  type!: SavedPaymentMethodType;

  @ApiPropertyOptional({ example: 'Carte principale' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ example: '5412 1235 4512 2353' })
  @ValidateIf((dto: SavePaymentMethodDto) => dto.type === SavedPaymentMethodType.CARD)
  @IsString()
  @MaxLength(30)
  cardNumber?: string;

  @ApiPropertyOptional({ example: 'Dia Mamadou Thiam' })
  @ValidateIf((dto: SavePaymentMethodDto) => dto.type === SavedPaymentMethodType.CARD)
  @IsString()
  @MaxLength(100)
  holderName?: string;

  @ApiPropertyOptional({ example: 12 })
  @ValidateIf((dto: SavePaymentMethodDto) => dto.type === SavedPaymentMethodType.CARD)
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth?: number;

  @ApiPropertyOptional({ example: 2028 })
  @ValidateIf((dto: SavePaymentMethodDto) => dto.type === SavedPaymentMethodType.CARD)
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(2024)
  @Max(2100)
  expiryYear?: number;

  @ApiPropertyOptional({ example: '+221770000000' })
  @ValidateIf((dto: SavePaymentMethodDto) => dto.type === SavedPaymentMethodType.WAVE)
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}

export class UpdateSavedPaymentMethodDto {
  @ApiPropertyOptional({ example: 'Numero principal' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ example: '+221771112233' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '5412 1235 4512 2353' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cardNumber?: string;

  @ApiPropertyOptional({ example: 'Dia Mamadou Thiam' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  holderName?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth?: number;

  @ApiPropertyOptional({ example: 2028 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(2024)
  @Max(2100)
  expiryYear?: number;
}
