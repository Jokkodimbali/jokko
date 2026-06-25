import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MapsCoordinateDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class ComputeRoutesDto {
  @ValidateNested()
  @Type(() => MapsCoordinateDto)
  origin!: MapsCoordinateDto;

  @ValidateNested()
  @Type(() => MapsCoordinateDto)
  destination!: MapsCoordinateDto;

  @IsOptional()
  @IsBoolean()
  alternatives?: boolean;
}

export class ReverseGeocodeQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
