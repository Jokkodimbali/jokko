import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class SubmitKycDto {
  @ApiProperty({
    description: "URL de la piece d'identite",
    example: 'https://example.com/images/cni.jpg',
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
}
