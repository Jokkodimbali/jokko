import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

/**
 * Type de prix du service professionnel.
 *
 * Logique métier pour la négociation de prix :
 * Le professionnel doit indiquer si le prix du service est fixe ou négociable.
 * S'il est fixe, c'est bon. Si c'est négociable, il discute avec le client,
 * et si le client n'accepte pas le prix, il lui propose un autre prix jusqu'à ce
 * qu'ils tombent d'accord sur le prix, puis le client passe au paiement.
 */
export enum ServicePriceType {
  FIXE = 'FIXE',
  NEGOCIABLE = 'NEGOCIABLE',
}

export class CreateProfessionalServiceDto {
  @ApiProperty({
    description: 'ID de la categorie du service',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.CATEGORY_ID_FORMAT })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.CATEGORY_ID_REQUIRED })
  categoryId!: string;

  @ApiProperty({
    description: 'Nom du service',
    example: 'Creation site web',
    maxLength: 200,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.SERVICE_NAME_REQUIRED })
  @IsString()
  @MaxLength(200, { message: VALIDATION_MESSAGES.SERVICE_NAME_MAX })
  name!: string;

  @ApiProperty({
    description: 'Description du service',
    example: 'Je cree des sites web modernes et responsifs',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.SERVICE_DESCRIPTION_REQUIRED })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Prix du service en FCFA',
    example: 50000,
    minimum: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsNotEmpty()
  @IsNumber({}, { message: VALIDATION_MESSAGES.SERVICE_PRICE_INVALID })
  @IsPositive({ message: VALIDATION_MESSAGES.SERVICE_PRICE_MUST_BE_POSITIVE })
  price!: number;

  @ApiProperty({
    description: 'Type de prix',
    enum: ServicePriceType,
    example: ServicePriceType.FIXE,
  })
  @IsNotEmpty()
  @IsEnum(ServicePriceType, {
    message: VALIDATION_MESSAGES.SERVICE_PRICE_TYPE_INVALID,
  })
  priceType!: ServicePriceType;
}
