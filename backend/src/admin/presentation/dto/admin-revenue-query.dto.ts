import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type AdminRevenuePeriod = '7d' | '30d' | '90d' | '12m';

export class AdminRevenueQueryDto {
  @ApiPropertyOptional({
    description: "Periode d'analyse du chiffre d'affaires",
    enum: ['7d', '30d', '90d', '12m'],
    default: '12m',
  })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '12m'])
  period?: AdminRevenuePeriod;
}

