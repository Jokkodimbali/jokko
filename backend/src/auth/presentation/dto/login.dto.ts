import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  isEmail,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import {
  SENEGAL_PHONE_PATTERN,
  normalizeSenegalPhoneNumber,
} from '../../domain/validators/phone-number.validator';

function normalizeLoginIdentifier(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.includes('@')
    ? trimmed.toLowerCase()
    : normalizeSenegalPhoneNumber(trimmed);
}

@ValidatorConstraint({ name: 'LoginIdentifier', async: false })
class LoginIdentifierConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !value) {
      return false;
    }

    return value.includes('@')
      ? isEmail(value)
      : SENEGAL_PHONE_PATTERN.test(value);
  }

  defaultMessage(): string {
    return VALIDATION_MESSAGES.LOGIN_IDENTIFIER_FORMAT;
  }
}

export class LoginDto {
  @ApiProperty({
    description: 'Numero de telephone senegalais ou adresse email',
    example: '+221770000000',
  })
  @Transform(({ value }: { value: unknown }) => normalizeLoginIdentifier(value))
  @IsNotEmpty({ message: VALIDATION_MESSAGES.LOGIN_IDENTIFIER_FORMAT })
  @IsString()
  @Validate(LoginIdentifierConstraint)
  identifier!: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'MonMotDePasse123!',
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @IsString()
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  password!: string;
}
