import { Transform } from 'class-transformer';
import { IsString, IsUrl } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class SubmitKycDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.KYC_ID_CARD_URL_REQUIRED })
  @IsUrl({}, { message: VALIDATION_MESSAGES.KYC_ID_CARD_URL_INVALID })
  idCardUrl!: string;
}
