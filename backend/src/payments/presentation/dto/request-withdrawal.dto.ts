import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min, Max } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class RequestWithdrawalDto {
  @ApiProperty({
    description: API_DOCS.payments.amountDescription,
    example: 25000,
    minimum: 2000,
    maximum: 500000,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.WITHDRAWAL_AMOUNT_REQUIRED })
  @IsNumber({}, { message: VALIDATION_MESSAGES.WITHDRAWAL_AMOUNT_INVALID })
  @Min(2000, { message: VALIDATION_MESSAGES.WITHDRAWAL_AMOUNT_MIN })
  @Max(500000, { message: VALIDATION_MESSAGES.WITHDRAWAL_AMOUNT_MAX })
  amount!: number;

  @ApiProperty({
    description: API_DOCS.payments.methodDescription,
    example: 'WAVE',
    enum: ['WAVE', 'ORANGE_MONEY'],
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.WITHDRAWAL_METHOD_REQUIRED })
  @IsString({ message: VALIDATION_MESSAGES.WITHDRAWAL_METHOD_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  method!: 'WAVE' | 'ORANGE_MONEY';
}
