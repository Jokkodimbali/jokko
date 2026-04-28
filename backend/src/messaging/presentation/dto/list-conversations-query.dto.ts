import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.messaging.limitField,
    example: 20,
    default: 20,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.MESSAGING_LIMIT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.MESSAGING_LIMIT_MIN })
  @Max(100, { message: VALIDATION_MESSAGES.MESSAGING_LIMIT_MAX })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: API_DOCS.messaging.offsetField,
    example: 0,
    default: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.MESSAGING_OFFSET_INVALID })
  @Min(0, { message: VALIDATION_MESSAGES.MESSAGING_OFFSET_MIN })
  offset?: number = 0;
}
