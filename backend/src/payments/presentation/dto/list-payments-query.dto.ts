import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../domain/value-objects/payment-types.vo';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.payments.methodFilter,
    example: 'WAVE',
  })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: VALIDATION_MESSAGES.PAYMENT_METHOD_INVALID,
  })
  method?: PaymentMethod;

  @ApiPropertyOptional({
    description: API_DOCS.payments.statusFilter,
    example: 'SUCCES',
  })
  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: VALIDATION_MESSAGES.PAYMENT_STATUS_INVALID,
  })
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: API_DOCS.payments.bookingFilter,
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.PAYMENT_BOOKING_ID_FORMAT })
  bookingId?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.clientFilter,
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.professionalFilter,
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  professionalId?: string;

  @ApiPropertyOptional({
    description: API_DOCS.payments.limitDescription,
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: API_DOCS.payments.offsetDescription,
    example: 0,
    minimum: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  offset?: number;
}
