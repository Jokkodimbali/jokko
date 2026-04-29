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
  @ApiPropertyOptional({
    description: API_DOCS.reservations.cancelReasonField,
    example: 'Le client nest plus disponible a cette heure.',
  })
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
    example: '2026-05-03T14:30:00.000Z',
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
    example: 'Des pieces supplementaires doivent etre remplacees sur place.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: VALIDATION_MESSAGES.RESERVATION_PRICE_ADJUSTMENT_REASON_MAX,
  })
  reason?: string;
}

export class SubmitReservationReviewDto {
  @ApiProperty({
    description: API_DOCS.reservations.reviewRatingField,
    example: 5,
  })
  @IsNumber(
    { maxDecimalPlaces: 0 },
    {
      message: VALIDATION_MESSAGES.RESERVATION_REVIEW_RATING_INVALID,
    },
  )
  @Min(1, {
    message: VALIDATION_MESSAGES.RESERVATION_REVIEW_RATING_MIN,
  })
  @Max(5, {
    message: VALIDATION_MESSAGES.RESERVATION_REVIEW_RATING_MAX,
  })
  rating!: number;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.reviewCommentField,
    example: 'Intervention rapide, propre et tres professionnelle.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: VALIDATION_MESSAGES.RESERVATION_REVIEW_MAX,
  })
  review?: string;
}
