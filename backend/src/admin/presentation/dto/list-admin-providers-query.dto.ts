import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutKyc } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListAdminProvidersQueryDto {
  @ApiPropertyOptional({
    description: 'Recherche par nom, entreprise, telephone ou ville.',
    example: 'Touba',
    maxLength: 120,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par statut KYC.',
    enum: StatutKyc,
  })
  @IsOptional()
  @IsEnum(StatutKyc)
  kycStatus?: StatutKyc;

  @ApiPropertyOptional({
    description: 'Filtrer par etat du compte utilisateur.',
    example: true,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 1 })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, example: 12 })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
