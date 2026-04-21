import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PaymentFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: [
      'PENDING',
      'PROCESSING',
      'SUCCESS',
      'FAILED',
      'CANCELLED',
      'REFUNDED',
    ],
    example: 'SUCCESS',
  })
  @IsOptional()
  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: ['WAVE', 'ORANGE_MONEY', 'CARD'],
    example: 'WAVE',
  })
  @IsOptional()
  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  method?: string;

  @ApiPropertyOptional({
    description: 'Filter by escrow status (for professionals)',
    enum: ['LOCKED', 'RELEASED', 'DISPUTED', 'REFUNDED'],
    example: 'LOCKED',
  })
  @IsOptional()
  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  escrowStatus?: string;

  @ApiPropertyOptional({
    description: 'Limit results',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Offset for pagination',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
