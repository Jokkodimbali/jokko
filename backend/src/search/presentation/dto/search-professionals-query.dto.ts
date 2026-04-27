import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class SearchProfessionalsQueryDto {
  @ApiPropertyOptional({
    description: 'Ville du professionnel',
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
    description: 'Identifiant de la categorie',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.SEARCH_CATEGORY_ID_FORMAT })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Texte libre de recherche',
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
    description: 'Latitude GPS',
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
    description: 'Longitude GPS',
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
    description: 'Rayon de recherche en kilometres',
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
    description: 'Numero de page',
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
    description: 'Nombre de resultats par page',
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
