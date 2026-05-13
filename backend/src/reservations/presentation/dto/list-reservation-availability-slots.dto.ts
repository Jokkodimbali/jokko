import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsUUID, Max, Min } from 'class-validator';

export class ListReservationAvailabilitySlotsQueryDto {
  @IsUUID()
  professionalId!: string;

  @IsISO8601({ strict: false })
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  dureeMinutes!: number;
}
