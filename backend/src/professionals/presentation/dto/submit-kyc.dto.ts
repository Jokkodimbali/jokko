import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class SubmitKycDto {
  @ApiProperty({
    description: "URL du recto de la pièce d'identité (CNI)",
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
    description: "URL du verso de la pièce d'identité (CNI)",
    example: 'https://example.com/images/cni-verso.jpg',
    format: 'uri',
    required: false,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    {
      message: VALIDATION_MESSAGES.KYC_ID_CARD_URL_INVALID,
    },
  )
  idCardUrlVerso?: string;
}
