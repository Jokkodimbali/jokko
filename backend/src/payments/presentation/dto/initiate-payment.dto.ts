import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/messages/validation-message.catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';

export class InitiatePaymentDto {
  @ApiProperty({
    description: API_DOCS.payments.bookingIdDescription,
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.PAYMENT_BOOKING_ID_FORMAT })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PAYMENT_BOOKING_ID_REQUIRED })
  bookingId!: string;

  @ApiProperty({
    description: API_DOCS.payments.paymentMethodDescription,
    example: PaymentMethod.WAVE,
    enum: PaymentMethod,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PAYMENT_METHOD_REQUIRED })
  @IsString({ message: VALIDATION_MESSAGES.PAYMENT_METHOD_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  method!: PaymentMethod;

  @ApiProperty({
    description: API_DOCS.payments.callbackUrlDescription,
    example: 'https://api.jokko.sn/payments/callback',
    required: false,
  })
  @IsString({ message: VALIDATION_MESSAGES.PAYMENT_CALLBACK_URL_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  callbackUrl?: string;

  @ApiProperty({
    description: API_DOCS.payments.successUrlDescription,
    example: 'https://app.jokko.sn/payment-success',
    required: false,
  })
  @IsString({ message: VALIDATION_MESSAGES.PAYMENT_SUCCESS_URL_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  successUrl?: string;

  @ApiProperty({
    description: API_DOCS.payments.cancelUrlDescription,
    example: 'https://app.jokko.sn/payment-failed',
    required: false,
  })
  @IsString({ message: VALIDATION_MESSAGES.PAYMENT_CANCEL_URL_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  cancelUrl?: string;
}
