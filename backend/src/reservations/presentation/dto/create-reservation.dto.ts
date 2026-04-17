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

export class CreateReservationDto {
  @ApiProperty({ description: 'Identifiant du profil professionnel' })
  @IsUUID('4', {
    message: VALIDATION_MESSAGES.RESERVATION_PROFESSIONAL_ID_FORMAT,
  })
  professionnelId!: string;

  @ApiProperty({ description: 'Identifiant du service reserve' })
  @IsUUID('4', { message: VALIDATION_MESSAGES.SERVICE_ID_FORMAT })
  serviceId!: string;

  @ApiProperty({ description: 'Date et heure de reservation en ISO 8601' })
  @IsDateString({}, { message: VALIDATION_MESSAGES.RESERVATION_DATE_INVALID })
  dateHeure!: string;

  @ApiProperty({ description: 'Adresse du client pour la prestation' })
  @IsString()
  @IsNotEmpty({
    message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_REQUIRED,
  })
  @MaxLength(255, { message: VALIDATION_MESSAGES.RESERVATION_ADDRESS_MAX })
  adresseClient!: string;

  @ApiProperty({ description: 'Duree de reservation en minutes' })
  @IsInt({ message: VALIDATION_MESSAGES.RESERVATION_DURATION_INTEGER })
  @Min(15, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MIN })
  @Max(1440, { message: VALIDATION_MESSAGES.RESERVATION_DURATION_MAX })
  dureeMinutes!: number;

  @ApiPropertyOptional({ description: 'Notes libres de reservation' })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: VALIDATION_MESSAGES.RESERVATION_NOTES_MAX })
  notes?: string;
}
