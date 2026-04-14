import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class RejectKycDto {
  @ApiProperty({
    description: 'Motif du rejet KYC',
    example: 'La photo de la carte d identite est floue et illisible',
    minLength: 10,
    maxLength: 1000,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.KYC_REJECT_REASON_REQUIRED })
  @IsString()
  @MinLength(10, { message: VALIDATION_MESSAGES.KYC_REJECT_REASON_MIN })
  @MaxLength(1000, { message: VALIDATION_MESSAGES.KYC_REJECT_REASON_MAX })
  reason!: string;
}
