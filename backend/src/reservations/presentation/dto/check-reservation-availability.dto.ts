import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CheckReservationAvailabilityQueryDto {
  @IsUUID()
  professionalId!: string;

  @IsISO8601()
  dateHeure!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  dureeMinutes!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  pauseMinutes?: number;
}
