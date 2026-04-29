import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class BroadcastNotificationDto {
  @ApiProperty({
    description: API_DOCS.adminNotifications.broadcastTargetField,
    enum: ['CLIENT', 'PRESTATAIRE', 'ALL'],
    example: API_DOCS.adminNotifications.broadcastTargetExample,
  })
  @IsNotEmpty({
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_TARGET_REQUIRED,
  })
  @IsIn(['CLIENT', 'PRESTATAIRE', 'ALL'], {
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_TARGET_INVALID,
  })
  target!: 'CLIENT' | 'PRESTATAIRE' | 'ALL';

  @ApiProperty({
    description: API_DOCS.adminNotifications.broadcastTitleField,
    maxLength: 200,
    example: API_DOCS.adminNotifications.broadcastTitleExample,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_TITLE_REQUIRED,
  })
  @IsString({
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_TITLE_REQUIRED,
  })
  @MaxLength(200, {
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_TITLE_MAX,
  })
  title!: string;

  @ApiProperty({
    description: API_DOCS.adminNotifications.broadcastBodyField,
    maxLength: 2000,
    example: API_DOCS.adminNotifications.broadcastBodyExample,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_BODY_REQUIRED,
  })
  @IsString({
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_BODY_REQUIRED,
  })
  @MaxLength(2000, {
    message: VALIDATION_MESSAGES.NOTIFICATION_BROADCAST_BODY_MAX,
  })
  body!: string;

  @ApiPropertyOptional({
    description: API_DOCS.adminNotifications.broadcastDataField,
    type: 'object',
    additionalProperties: true,
    example: { kind: 'maintenance', scheduledAt: '2026-05-01T23:00:00.000Z' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
