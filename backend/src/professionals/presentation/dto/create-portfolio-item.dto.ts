import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class CreatePortfolioItemDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.PORTFOLIO_TITLE_REQUIRED })
  @MaxLength(200, { message: VALIDATION_MESSAGES.PORTFOLIO_TITLE_MAX })
  title!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.PORTFOLIO_TITLE_REQUIRED })
  description?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.PORTFOLIO_IMAGE_URL_REQUIRED })
  @IsUrl({}, { message: VALIDATION_MESSAGES.PORTFOLIO_IMAGE_URL_INVALID })
  imageUrl!: string;
}
