import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class SubmitKycDto {
  @ApiProperty({
    description: API_DOCS.professionals.kycFrontUrlField,
    example: 'https://example.com/images/cni-recto.jpg',
    format: 'uri',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.KYC_ID_CARD_URL_REQUIRED })
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    {
      message: VALIDATION_MESSAGES.KYC_ID_CARD_URL_INVALID,
    },
  )
  idCardUrl!: string;

  @ApiProperty({
    description: API_DOCS.professionals.kycBackUrlField,
    example: 'https://example.com/images/cni-verso.jpg',
    format: 'uri',
    required: false,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    {
      message: VALIDATION_MESSAGES.KYC_ID_CARD_URL_INVALID,
    },
  )
  idCardUrlVerso?: string;
}
