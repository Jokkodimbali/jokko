import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class PaymentWebhookDto {
  @ApiPropertyOptional({
    description: API_DOCS.payments.webhookGatewayReferenceDescription,
    example: 'inv_xxx_yyy',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.webhookInvoiceTokenDescription,
    example: 'invoice_token_xxx',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  invoice_token?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.webhookStatusDescription,
    enum: ['completed', 'failed', 'cancelled', 'pending'],
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  status?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.webhookSignatureDescription,
    example: 'b1a4f2...',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  signature?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.webhookTimestampDescription,
    example: '1776787200',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  timestamp?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.webhookMetadataDescription,
    type: Object,
    additionalProperties: true,
    example: { custom_data: 'value' },
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }): Record<string, unknown> =>
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {},
  )
  metadata?: Record<string, unknown>;

  toRecord(): Record<string, unknown> {
    return {
      ...(this.gatewayReference
        ? { gatewayReference: this.gatewayReference }
        : {}),
      ...(this.invoice_token ? { invoice_token: this.invoice_token } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.signature ? { signature: this.signature } : {}),
      ...(this.timestamp ? { timestamp: this.timestamp } : {}),
      ...(this.metadata ? { metadata: this.metadata } : {}),
    };
  }
}
