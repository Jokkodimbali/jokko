import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class MyHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Nombre de resultats (defaut: 20, max: 100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.HISTORY_LIMIT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.HISTORY_LIMIT_INVALID })
  @Max(100, { message: VALIDATION_MESSAGES.HISTORY_LIMIT_MAX })
  limit?: number;
}
