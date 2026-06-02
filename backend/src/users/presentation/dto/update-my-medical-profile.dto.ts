import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimOptional(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeTextList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export class UpdateMyMedicalProfileDto {
  @ApiPropertyOptional({ example: 'B+' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(8)
  bloodGroup?: string | null;

  @ApiPropertyOptional({ example: 'Positif' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rhesus?: string | null;

  @ApiPropertyOptional({ example: 62 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(400)
  weightKg?: number | null;

  @ApiPropertyOptional({ example: 168 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(260)
  heightCm?: number | null;

  @ApiPropertyOptional({ example: 'Dr. Amadou Fall' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceDoctorName?: string | null;

  @ApiPropertyOptional({ example: 'Infirmiere' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['Allergie : Penicilline'] })
  @Transform(({ value }: { value: unknown }) => normalizeTextList(value))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  allergies?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Asthme leger'] })
  @Transform(({ value }: { value: unknown }) => normalizeTextList(value))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  conditions?: string[];
}
