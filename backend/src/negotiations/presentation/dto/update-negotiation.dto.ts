import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CounterNegotiationDto {
  @ApiPropertyOptional({
    description: API_DOCS.negotiations.counterAmountField,
    example: 15000,
  })
  @IsNumber({}, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_MIN })
  @Max(100000000, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_MAX })
  proposedAmount!: number;

  @ApiPropertyOptional({
    description: API_DOCS.negotiations.counterMessageField,
    example: 'Je peux faire un effort a ce prix.',
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

export class CloseNegotiationDto {
  @ApiPropertyOptional({
    description: API_DOCS.negotiations.closeReasonField,
    example: 'Budget non compatible avec la prestation demandee.',
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.NEGOTIATION_REASON_INVALID })
  @MaxLength(1000, { message: VALIDATION_MESSAGES.NEGOTIATION_REASON_MAX })
  reason?: string;
}
