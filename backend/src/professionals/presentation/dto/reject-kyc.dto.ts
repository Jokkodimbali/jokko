import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class RejectKycDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.KYC_REJECT_REASON_REQUIRED })
  @MinLength(10, { message: VALIDATION_MESSAGES.KYC_REJECT_REASON_MIN })
  @MaxLength(1000, { message: VALIDATION_MESSAGES.KYC_REJECT_REASON_MAX })
  reason!: string;
}
