import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

enum ServicePriceType {
  FIXE = 'FIXE',
  NEGOCIABLE = 'NEGOCIABLE',
}

export class CreateProfessionalServiceDto {
  @IsUUID('4', { message: VALIDATION_MESSAGES.CATEGORY_ID_REQUIRED })
  categoryId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.SERVICE_NAME_REQUIRED })
  @MaxLength(200, { message: VALIDATION_MESSAGES.SERVICE_NAME_MAX })
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.SERVICE_DESCRIPTION_REQUIRED })
  description!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsNumber({}, { message: VALIDATION_MESSAGES.SERVICE_PRICE_INVALID })
  @IsPositive({ message: VALIDATION_MESSAGES.SERVICE_PRICE_INVALID })
  price!: number;

  @IsEnum(ServicePriceType, {
    message: VALIDATION_MESSAGES.SERVICE_PRICE_TYPE_INVALID,
  })
  priceType!: ServicePriceType;
}
