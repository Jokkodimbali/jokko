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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.CITY_MAX })
  @MaxLength(100, { message: VALIDATION_MESSAGES.CITY_MAX })
  city?: string;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.PROFESSIONALS_LIMIT_MIN })
  @Min(1, { message: VALIDATION_MESSAGES.PROFESSIONALS_LIMIT_MIN })
  @Max(50, { message: VALIDATION_MESSAGES.PROFESSIONALS_LIMIT_MAX })
  limit?: number;
}
