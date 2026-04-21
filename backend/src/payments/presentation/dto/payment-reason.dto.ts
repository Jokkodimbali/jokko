import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class PaymentReasonDto {
  @ApiPropertyOptional({
    description: API_DOCS.payments.reasonDescription,
    example: 'Prestation non conforme.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.PAYMENT_REASON_MAX })
  @MaxLength(1000, { message: VALIDATION_MESSAGES.PAYMENT_REASON_MAX })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason?: string;
}
