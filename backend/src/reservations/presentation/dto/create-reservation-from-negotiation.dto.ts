import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CreateReservationFromNegotiationDto {
  @ApiProperty({
    description: API_DOCS.negotiations.negotiationIdParam,
    example: '770e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.RESERVATION_NEGOTIATION_ID_FORMAT,
  })
  negotiationId!: string;

  @ApiProperty({
    description: API_DOCS.reservations.dateTimeField,
    example: '2026-05-02T14:00:00.000Z',
  })
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  dateHeure!: string;

  @ApiProperty({
    description: API_DOCS.reservations.addressField,
    example: 'Dakar Plateau',
  })
  @IsString({ message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_REQUIRED })
  @MaxLength(255, { message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_MAX })
  adresseClient!: string;

  @ApiPropertyOptional({ description: 'Latitude GPS du lieu d intervention.', example: 14.716677 })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  @Min(-90, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  @Max(90, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  clientLatitude?: number;

  @ApiPropertyOptional({ description: 'Longitude GPS du lieu d intervention.', example: -17.467686 })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  @Min(-180, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  @Max(180, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  clientLongitude?: number;

  @ApiProperty({
    description: API_DOCS.reservations.durationField,
    example: 90,
    minimum: 5,
    maximum: 1440,
  })
  @IsInt({ message: VALIDATION_MESSAGES.RESERVATION_DURATION_INTEGER })
  @Min(5, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MIN })
  @Max(1440, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MAX })
  dureeMinutes!: number;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.notesField,
    example: 'Prix negocie valide avec le professionnel.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: VALIDATION_MESSAGES.RESERVATION_NOTES_MAX })
  notes?: string;
}
