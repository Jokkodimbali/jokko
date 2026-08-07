import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import type { CreateMaterialQuoteInput } from '../../application/models/material-quote-input';

export class CreateMaterialQuoteDto implements CreateMaterialQuoteInput {
  @ApiProperty({ example: 'PVC' })
  @IsString({ message: VALIDATION_MESSAGES.NEGOTIATION_MESSAGE_INVALID })
  @MaxLength(180, { message: VALIDATION_MESSAGES.NEGOTIATION_MESSAGE_MAX })
  designation!: string;

  @ApiProperty({ example: 8500 })
  @IsNumber({}, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_MIN })
  @Max(100000000, { message: VALIDATION_MESSAGES.NEGOTIATION_AMOUNT_MAX })
  unitPrice!: number;

  @ApiProperty({ example: 6 })
  @IsInt({ message: VALIDATION_MESSAGES.RESERVATION_DURATION_INTEGER })
  @Min(1, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MIN })
  @Max(1000, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MAX })
  quantity!: number;

  @ApiPropertyOptional({
    enum: ['CLIENT', 'PRESTATAIRE'],
    example: 'PRESTATAIRE',
  })
  @IsOptional()
  @IsIn(['CLIENT', 'PRESTATAIRE'])
  createdBy?: 'CLIENT' | 'PRESTATAIRE';
}

export class FinalizeMaterialQuoteDto {
  @ApiProperty({ example: '960e8400-e29b-41d4-a716-446655440031' })
  @IsString()
  reservationId!: string;
}
