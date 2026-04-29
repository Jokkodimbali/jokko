import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CreateNegotiationDto {
  @ApiProperty({
    description: API_DOCS.negotiations.serviceIdField,
    example: '960e8400-e29b-41d4-a716-446655440031',
    format: 'uuid',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.SERVICE_ID_FORMAT })
  serviceId!: string;

  @ApiProperty({
    description: API_DOCS.negotiations.proposedAmountField,
    example: 14000,
  })
  @IsNumber({}, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_MIN })
  @Max(100000000, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_MAX })
  proposedAmount!: number;

  @ApiPropertyOptional({
    description: API_DOCS.negotiations.messageField,
    example: 'Je peux confirmer rapidement si nous restons sur ce budget.',
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.NEGOTIATION_MESSAGE_INVALID })
  @MaxLength(1000, { message: VALIDATION_MESSAGES.NEGOTIATION_MESSAGE_MAX })
  message?: string;
}
