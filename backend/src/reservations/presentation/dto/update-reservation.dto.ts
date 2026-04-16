import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class ConfirmReservationDto {
  @IsString()
  @IsNotEmpty()
  reservationId!: string;
}

export class CancelReservationDto {
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class RescheduleReservationDto {
  @IsString()
  @IsNotEmpty()
  reservationId!: string;

  @IsDateString()
  @IsNotEmpty()
  newDateTime!: string;
}
