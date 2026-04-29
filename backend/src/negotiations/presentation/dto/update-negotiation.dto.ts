import { ApiPropertyOptional } from '@nestjs/swagger';
import {
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
