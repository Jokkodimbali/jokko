import {
  IsDateString,
  IsInt,
  IsNotEmpty,
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

export class CreateReservationDto {
  @ApiProperty({
    description: API_DOCS.reservations.professionalIdField,
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.RESERVATION_PROFESSIONAL_ID_FORMAT,
  })
  professionnelId!: string;

  @ApiProperty({
    description: API_DOCS.reservations.serviceIdField,
    example: '660e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.SERVICE_ID_FORMAT })
  serviceId!: string;

  @ApiProperty({
    description: API_DOCS.reservations.dateTimeField,
    example: '2026-05-01T10:30:00.000Z',
  })
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  dateHeure!: string;

  @ApiProperty({
    description: API_DOCS.reservations.addressField,
    example: 'Dakar Plateau, Avenue Pompidou',
  })
  @IsString()
  @IsNotEmpty({
    message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_REQUIRED,
  })
  @MaxLength(255, { message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_MAX })
  adresseClient!: string;

  @ApiProperty({
    description: API_DOCS.reservations.durationField,
    example: 60,
    minimum: 15,
    maximum: 1440,
  })
  @IsInt({ message: VALIDATION_MESSAGES.RESERVATION_DURATION_INTEGER })
  @Min(15, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MIN })
  @Max(1440, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MAX })
  dureeMinutes!: number;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.notesField,
    example: 'Merci de venir avec le materiel necessaire.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: VALIDATION_MESSAGES.RESERVATION_NOTES_MAX })
  notes?: string;
}
