import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'Nom de la categorie',
    example: 'Plomberie & Sanitaire',
    required: false,
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.CATEGORY_NAME_MIN })
  @MinLength(2, { message: VALIDATION_MESSAGES.CATEGORY_NAME_MIN })
  @MaxLength(100, { message: VALIDATION_MESSAGES.CATEGORY_NAME_MAX })
  name?: string;

  @ApiProperty({
    description: "URL publique de l'icone",
    example: 'https://cdn.jokko.sn/icons/plomberie-v2.png',
    required: false,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.CATEGORY_ICON_URL_INVALID })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: VALIDATION_MESSAGES.CATEGORY_ICON_URL_INVALID },
  )
  iconUrl?: string | null;

  @ApiProperty({
    description: 'Ordre de tri de la categorie',
    example: 2,
    required: false,
    minimum: 0,
    maximum: 32767,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.CATEGORY_SORT_ORDER_INTEGER })
  @Min(0, { message: VALIDATION_MESSAGES.CATEGORY_SORT_ORDER_MIN })
  @Max(32767, { message: VALIDATION_MESSAGES.CATEGORY_SORT_ORDER_MAX })
  sortOrder?: number;
}
