import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaymentWebhookDto {
  @ApiPropertyOptional({
    description: 'Gateway reference or invoice token from webhook',
    example: 'inv_xxx_yyy',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.trim() : value,
  )
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Invoice token (Paydunya-specific)',
    example: 'invoice_token_xxx',
  })
  @IsString()
  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.trim() : value,
  )
  invoice_token?: string;

  @ApiPropertyOptional({
    description: 'Payment status from gateway',
    enum: ['completed', 'failed', 'cancelled', 'pending'],
    example: 'completed',
  })
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Additional gateway metadata',
    type: Object,
    additionalProperties: true,
    example: { custom_data: 'value' },
  })
  @IsOptional()
  @Transform(
    ({ value }): Record<string, unknown> =>
      typeof value === 'object' && value !== null ? value : {},
  )
  metadata?: Record<string, unknown>;
}
