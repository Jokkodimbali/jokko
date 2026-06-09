import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class CreatePortfolioItemDto {
  @ApiProperty({
    description: API_DOCS.professionals.portfolioTitleField,
    example: 'Site e-commerce pour une boutique',
    maxLength: 200,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PORTFOLIO_TITLE_REQUIRED })
  @IsString()
  @MaxLength(200, { message: VALIDATION_MESSAGES.PORTFOLIO_TITLE_MAX })
  title!: string;

  @ApiProperty({
    description: API_DOCS.professionals.portfolioDescriptionField,
    example: 'Developpe d un site e-commerce complet avec paiement integre',
    required: false,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({
    description: API_DOCS.professionals.portfolioImageUrlField,
    example: 'https://example.com/images/projet.jpg',
    format: 'uri',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PORTFOLIO_IMAGE_URL_REQUIRED })
  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    {
      message: VALIDATION_MESSAGES.PORTFOLIO_IMAGE_URL_INVALID,
    },
  )
  imageUrl!: string;
}
