import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class CreateProfessionalProfileDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.BIO_MAX })
  @MaxLength(1000, { message: VALIDATION_MESSAGES.BIO_MAX })
  bio?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMPANY_NAME_MAX })
  @MaxLength(150, { message: VALIDATION_MESSAGES.COMPANY_NAME_MAX })
  companyName?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.CITY_MAX })
  @MaxLength(100, { message: VALIDATION_MESSAGES.CITY_MAX })
  city?: string | null;
}
