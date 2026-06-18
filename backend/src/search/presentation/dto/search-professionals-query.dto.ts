import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class SearchProfessionalsQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.search.cityField,
    example: 'Dakar',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: VALIDATION_MESSAGES.CITY_MAX })
  city?: string;

  @ApiPropertyOptional({
    description: API_DOCS.search.categoryIdField,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.SEARCH_CATEGORY_ID_FORMAT })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Identifiant de la sous-categorie de service a filtrer.',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.SEARCH_CATEGORY_ID_FORMAT })
  subCategoryId?: string;

  @ApiPropertyOptional({
    description: API_DOCS.search.queryField,
    example: 'plombier urgence',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: VALIDATION_MESSAGES.SEARCH_QUERY_MAX })
  query?: string;

  @ApiPropertyOptional({
    description: 'Role professionnel a inclure dans les resultats',
    example: 'MEDECIN',
    enum: ['PRESTATAIRE', 'MEDECIN'],
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['PRESTATAIRE', 'MEDECIN'])
  role?: 'PRESTATAIRE' | 'MEDECIN';

  @ApiPropertyOptional({
    description: API_DOCS.search.latitudeField,
    example: 14.7167,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  @Min(-90, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  @Max(90, { message: VALIDATION_MESSAGES.SEARCH_LATITUDE_INVALID })
  latitude?: number;

  @ApiPropertyOptional({
    description: API_DOCS.search.longitudeField,
    example: -17.4677,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  @Min(-180, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  @Max(180, { message: VALIDATION_MESSAGES.SEARCH_LONGITUDE_INVALID })
  longitude?: number;

  @ApiPropertyOptional({
    description: API_DOCS.search.radiusKmField,
    example: 10,
    default: 25,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SEARCH_RADIUS_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.SEARCH_RADIUS_INVALID })
  @Max(100, { message: VALIDATION_MESSAGES.SEARCH_RADIUS_INVALID })
  radiusKm?: number = 25;

  @ApiPropertyOptional({
    description: API_DOCS.search.pageField,
    example: 1,
    default: 1,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.SEARCH_PAGE_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.SEARCH_PAGE_INVALID })
  page?: number = 1;

  @ApiPropertyOptional({
    description: API_DOCS.search.limitField,
    example: 20,
    default: 20,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(1, { message: VALIDATION_MESSAGES.SEARCH_LIMIT_MIN })
  @Max(50, { message: VALIDATION_MESSAGES.SEARCH_LIMIT_MAX })
  limit?: number = 20;
}
