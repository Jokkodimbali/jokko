import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  SENEGAL_PHONE_PATTERN,
  normalizeSenegalPhoneNumber,
} from '../../domain/validators/phone-number.validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: API_DOCS.auth.phoneNumberField,
    example: '+221770000000',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSenegalPhoneNumber(value) : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @IsString()
  @Matches(SENEGAL_PHONE_PATTERN, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;

  @ApiProperty({
    description: API_DOCS.auth.otpCodeField,
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.OTP_CODE_REQUIRED })
  @IsString()
  @Length(6, 6, { message: VALIDATION_MESSAGES.OTP_CODE_LENGTH })
  code!: string;
}
