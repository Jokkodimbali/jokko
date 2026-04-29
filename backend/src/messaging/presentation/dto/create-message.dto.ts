import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CreateMessageDto {
  @ApiPropertyOptional({
    description: API_DOCS.messaging.contentField,
    example: 'Bonjour, je suis en route.',
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.MESSAGING_MESSAGE_CONTENT_INVALID })
  @MaxLength(2000, {
    message: VALIDATION_MESSAGES.MESSAGING_MESSAGE_CONTENT_MAX,
  })
  content?: string;

  @ApiPropertyOptional({
    description: API_DOCS.messaging.mediaUrlField,
    example: 'https://cdn.jokko.sn/messages/photo-001.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: VALIDATION_MESSAGES.MESSAGING_MEDIA_URL_INVALID })
  mediaUrl?: string;
}
