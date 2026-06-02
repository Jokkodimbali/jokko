import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimOptional(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class UpsertMyMedicalTreatmentDto {
  @ApiProperty({ example: 'Vitamine D3 1000UI', minLength: 2, maxLength: 160 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: '1 cp' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string | null;

  @ApiPropertyOptional({ example: '1 fois par jour' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  frequency?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsDateString()
  startedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsDateString()
  endedAt?: string | null;

  @ApiPropertyOptional({ example: 'A prendre apres le repas.' })
  @Transform(({ value }: { value: unknown }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
