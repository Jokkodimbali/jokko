import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class UpdateFcmTokenDto {
  @ApiProperty({
    description: API_DOCS.notifications.fcmTokenDescription,
    example: 'fcm-device-token',
  })
  @IsString({ message: VALIDATION_MESSAGES.NOTIFICATION_FCM_TOKEN_INVALID })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.NOTIFICATION_FCM_TOKEN_REQUIRED })
  @MinLength(10, {
    message: VALIDATION_MESSAGES.NOTIFICATION_FCM_TOKEN_INVALID,
  })
  @MaxLength(500, {
    message: VALIDATION_MESSAGES.NOTIFICATION_FCM_TOKEN_TOO_LONG,
  })
  fcmToken!: string;
}
