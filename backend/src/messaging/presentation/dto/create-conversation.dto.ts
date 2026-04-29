import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CreateConversationDto {
  @ApiProperty({
    description: API_DOCS.messaging.reservationIdField,
    format: 'uuid',
    example: '650e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty({
    message: VALIDATION_MESSAGES.MESSAGING_RESERVATION_ID_REQUIRED,
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.MESSAGING_RESERVATION_ID_FORMAT })
  reservationId!: string;
}
