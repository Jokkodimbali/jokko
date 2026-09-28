import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class CreateServiceSubCategoryDto {
  @ApiProperty({
    example: 'Reparation et depannage',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.CATEGORY_NAME_REQUIRED })
  @IsString({ message: VALIDATION_MESSAGES.CATEGORY_NAME_REQUIRED })
  @MinLength(2, { message: VALIDATION_MESSAGES.CATEGORY_NAME_MIN })
  @MaxLength(120, { message: VALIDATION_MESSAGES.CATEGORY_NAME_MAX })
  name!: string;

  @ApiProperty({ required: false, example: 'Demandes courantes du service' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

}
