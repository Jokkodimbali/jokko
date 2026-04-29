import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class MyHistoryQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.users.historyLimitDescription,
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
