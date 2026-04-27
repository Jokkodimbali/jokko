import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class LoginDto {
  @ApiProperty({
    description: 'Numero de telephone',
    example: '+221770000000',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PHONE_REQUIRED })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: VALIDATION_MESSAGES.PHONE_FORMAT,
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'MonMotDePasse123!',
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @IsString()
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  password!: string;
}
