import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsDateString,
  IsInt,
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

  @ApiPropertyOptional({
    description: API_DOCS.reservations.dateTimeField,
    example: '2026-05-20T09:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  dateHeure?: string;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.addressField,
    example: '22 avenue de Diouf Ndiaye Yoff Dakar',
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.ADDRESS_INVALID })
  @MaxLength(180, { message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_MAX })
  adresseClient?: string;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.durationField,
    example: 60,
  })
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.RESERVATION_DURATION_INTEGER })
  @Min(15, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MIN })
  @Max(1440, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MAX })
  dureeMinutes?: number;
}
