import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.notifications.readFilter,
    example: false,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined) {
      return undefined;
    }

    return value === true || value === 'true';
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.NOTIFICATION_READ_INVALID })
  read?: boolean;

  @ApiPropertyOptional({
    description: API_DOCS.notifications.limitDescription,
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.NOTIFICATION_LIMIT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.NOTIFICATION_LIMIT_MIN })
  @Max(100, { message: VALIDATION_MESSAGES.NOTIFICATION_LIMIT_MAX })
  limit?: number;

  @ApiPropertyOptional({
    description: API_DOCS.notifications.offsetDescription,
    example: 0,
    minimum: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.NOTIFICATION_OFFSET_INVALID })
  @Min(0, { message: VALIDATION_MESSAGES.NOTIFICATION_OFFSET_MIN })
  offset?: number;
}
