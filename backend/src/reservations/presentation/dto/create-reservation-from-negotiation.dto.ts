import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';

export class CreateReservationFromNegotiationDto {
  @ApiProperty({
    description: 'Identifiant de la negotiation acceptee',
    example: '770e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.RESERVATION_NEGOTIATION_ID_FORMAT,
  })
  negotiationId!: string;

  @ApiProperty({
    description: 'Date et heure de reservation en ISO 8601',
    example: '2026-05-02T14:00:00.000Z',
  })
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  dateHeure!: string;

  @ApiProperty({
    description: 'Duree de reservation en minutes',
    example: 90,
  })
  @IsInt({ message: VALIDATION_MESSAGES.RESERVATION_DURATION_INTEGER })
  @Min(15, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MIN })
  @Max(1440, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MAX })
  dureeMinutes!: number;

  @ApiPropertyOptional({
    description: 'Notes libres de reservation',
    example: 'Prix negocie valide avec le professionnel.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: VALIDATION_MESSAGES.RESERVATION_NOTES_MAX })
  notes?: string;
}
