import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ADMIN_ARCHIVE_TABS = [
  'closedDisputes',
  'invoices',
  'transactions',
] as const;

export type AdminArchiveTab = (typeof ADMIN_ARCHIVE_TABS)[number];

export class AdminArchivesQueryDto {
  @ApiPropertyOptional({ enum: ADMIN_ARCHIVE_TABS, default: 'transactions' })
  @IsOptional()
  @IsIn(ADMIN_ARCHIVE_TABS)
  tab?: AdminArchiveTab;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ example: 'Wave Plomberie Touba' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
