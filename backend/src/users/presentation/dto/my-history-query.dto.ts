import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class MyHistoryQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.HISTORY_LIMIT_MIN })
  @Min(1, { message: VALIDATION_MESSAGES.HISTORY_LIMIT_MIN })
  @Max(100, { message: VALIDATION_MESSAGES.HISTORY_LIMIT_MAX })
  limit?: number;
}
