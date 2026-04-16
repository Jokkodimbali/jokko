import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationFromNegotiationDto {
  @ApiProperty({ description: 'ID de la négociation acceptée' })
  @IsString()
  @IsNotEmpty()
  negotiationId!: string;

  @ApiProperty({ description: 'Date et heure prévues pour la prestation' })
  @IsDateString()
  @IsNotEmpty()
  dateHeure!: string;

  @ApiProperty({ description: 'Durée estimée de la prestation en minutes' })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  dureeMinutes!: number;

  @ApiPropertyOptional({ description: 'Notes additionnelles' })
  @IsString()
  @IsOptional()
  notes?: string;
}
