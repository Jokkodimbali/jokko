import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CancelReservationDto {
  @ApiPropertyOptional({ description: API_DOCS.reservations.cancelReasonField })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: VALIDATION_MESSAGES.RESERVATION_CANCEL_REASON_MAX,
  })
  reason?: string;
}

export class RescheduleReservationDto {
  @ApiProperty({
    description: API_DOCS.reservations.newDateTimeField,
  })
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  newDateTime!: string;
}

export class ProposeReservationPriceAdjustmentDto {
  @ApiProperty({
    description: API_DOCS.reservations.proposedPriceField,
    example: 32000,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: VALIDATION_MESSAGES.RESERVATION_PRICE_ADJUSTMENT_AMOUNT_INVALID,
    },
  )
  @Min(1, {
    message: VALIDATION_MESSAGES.RESERVATION_PRICE_ADJUSTMENT_AMOUNT_MIN,
  })
  @Max(100000000, {
    message: VALIDATION_MESSAGES.RESERVATION_PRICE_ADJUSTMENT_AMOUNT_MAX,
  })
  proposedPrice!: number;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.priceAdjustmentReasonField,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: VALIDATION_MESSAGES.RESERVATION_PRICE_ADJUSTMENT_REASON_MAX,
  })
  reason?: string;
}
