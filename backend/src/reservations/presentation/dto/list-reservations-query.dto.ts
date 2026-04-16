import { IsDateString, IsOptional } from 'class-validator';

export class ListReservationsQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
