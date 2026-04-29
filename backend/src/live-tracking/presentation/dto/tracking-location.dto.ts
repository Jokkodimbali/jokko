import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { VALIDATION_MESSAGE_CATALOG } from '../../../core/messages/validation-message.catalog';

export class TrackingLocationDto {
  @ApiPropertyOptional({
    description: API_DOCS.liveTracking.latitudeField,
    example: 14.716677,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({}, { message: VALIDATION_MESSAGE_CATALOG.SEARCH_LATITUDE_INVALID })
  @Min(-90, { message: VALIDATION_MESSAGE_CATALOG.SEARCH_LATITUDE_INVALID })
  @Max(90, { message: VALIDATION_MESSAGE_CATALOG.SEARCH_LATITUDE_INVALID })
  latitude?: number;

  @ApiPropertyOptional({
    description: API_DOCS.liveTracking.longitudeField,
    example: -17.467686,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber(
    {},
    { message: VALIDATION_MESSAGE_CATALOG.SEARCH_LONGITUDE_INVALID },
  )
  @Min(-180, {
    message: VALIDATION_MESSAGE_CATALOG.SEARCH_LONGITUDE_INVALID,
  })
  @Max(180, {
    message: VALIDATION_MESSAGE_CATALOG.SEARCH_LONGITUDE_INVALID,
  })
  longitude?: number;

  @ApiPropertyOptional({
    description: API_DOCS.liveTracking.accuracyField,
    example: 12.5,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber(
    {},
    { message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_ACCURACY_INVALID },
  )
  @Min(0, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_ACCURACY_INVALID,
  })
  @Max(10000, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_ACCURACY_INVALID,
  })
  accuracyMeters?: number;

  @ApiPropertyOptional({
    description: API_DOCS.liveTracking.headingField,
    example: 180,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber(
    {},
    { message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_HEADING_INVALID },
  )
  @Min(0, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_HEADING_INVALID,
  })
  @Max(360, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_HEADING_INVALID,
  })
  headingDegrees?: number;

  @ApiPropertyOptional({
    description: API_DOCS.liveTracking.speedField,
    example: 28.4,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber(
    {},
    { message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_SPEED_INVALID },
  )
  @Min(0, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_SPEED_INVALID,
  })
  @Max(300, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_SPEED_INVALID,
  })
  speedKmh?: number;

  @ApiPropertyOptional({
    description: API_DOCS.liveTracking.locationLabelField,
    example: 'Corniche Ouest, Dakar',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: VALIDATION_MESSAGE_CATALOG.LIVE_TRACKING_LOCATION_LABEL_MAX,
  })
  locationLabel?: string;
}
