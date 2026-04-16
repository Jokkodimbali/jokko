import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  professionnelId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsDateString()
  @IsNotEmpty()
  dateHeure!: string;

  @IsInt()
  @Min(15)
  dureeMinutes!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateReservationFromNegotiationDto {
  @IsUUID('4')
  @IsNotEmpty()
  negotiationId!: string;

  @IsDateString()
  @IsNotEmpty()
  dateHeure!: string;

  @IsInt()
  @Min(15)
  dureeMinutes!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
