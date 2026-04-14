import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class ListProfessionalsQueryDto {
  @ApiProperty({
    description: 'Filtrer par ville',
    example: 'Dakar',
    required: false,
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: VALIDATION_MESSAGES.CITY_MAX })
  city?: string;

  @ApiProperty({
    description: 'Numero de page (pagination)',
    example: 1,
    required: false,
    default: 1,
    minimum: 1,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.PROFESSIONALS_PAGE_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.PROFESSIONALS_PAGE_INVALID })
  page?: number = 1;

  @ApiProperty({
    description: 'Nombre de resultats par page',
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(1, { message: VALIDATION_MESSAGES.PROFESSIONALS_LIMIT_MIN })
  @Max(50, { message: VALIDATION_MESSAGES.PROFESSIONALS_LIMIT_MAX })
  limit?: number = 20;
}
