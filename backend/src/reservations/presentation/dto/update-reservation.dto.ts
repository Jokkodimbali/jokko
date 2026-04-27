import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';

export class CancelReservationDto {
  @ApiPropertyOptional({ description: "Motif d'annulation" })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: VALIDATION_MESSAGES.RESERVATION_CANCEL_REASON_MAX,
  })
  reason?: string;
}

export class RescheduleReservationDto {
  @ApiProperty({
    description: 'Nouvelle date et heure de reservation en ISO 8601',
  })
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  newDateTime!: string;
}
