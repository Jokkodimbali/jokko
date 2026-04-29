import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class ListNegotiationsQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.negotiations.scopeField,
    enum: ['CLIENT', 'PRESTATAIRE'],
    example: 'CLIENT',
  })
  @IsOptional()
  @IsIn(['CLIENT', 'PRESTATAIRE'], {
    message: VALIDATION_MESSAGES.NEGOTIATION_SCOPE_INVALID,
  })
  scope?: 'CLIENT' | 'PRESTATAIRE';

  @ApiPropertyOptional({
    description: API_DOCS.negotiations.statusField,
    enum: [
      'EN_ATTENTE_PRESTATAIRE',
      'EN_ATTENTE_CLIENT',
      'ACCEPTEE',
      'REFUSEE',
      'ANNULEE',
      'CONVERTIE_EN_RESERVATION',
    ],
    example: 'EN_ATTENTE_PRESTATAIRE',
  })
  @IsOptional()
  @IsIn(
    [
      'EN_ATTENTE_PRESTATAIRE',
      'EN_ATTENTE_CLIENT',
      'ACCEPTEE',
      'REFUSEE',
      'ANNULEE',
      'CONVERTIE_EN_RESERVATION',
    ],
    { message: VALIDATION_MESSAGES.NEGOTIATION_STATUS_INVALID },
  )
  status?:
    | 'EN_ATTENTE_PRESTATAIRE'
    | 'EN_ATTENTE_CLIENT'
    | 'ACCEPTEE'
    | 'REFUSEE'
    | 'ANNULEE'
    | 'CONVERTIE_EN_RESERVATION';

  @ApiPropertyOptional({
    description: API_DOCS.negotiations.limitField,
    example: 20,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.NEGOTIATION_LIMIT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.NEGOTIATION_LIMIT_MIN })
  @Max(100, { message: VALIDATION_MESSAGES.NEGOTIATION_LIMIT_MAX })
  limit?: number;

  @ApiPropertyOptional({
    description: API_DOCS.negotiations.offsetField,
    example: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.NEGOTIATION_OFFSET_INVALID })
  @Min(0, { message: VALIDATION_MESSAGES.NEGOTIATION_OFFSET_MIN })
  offset?: number;
}
