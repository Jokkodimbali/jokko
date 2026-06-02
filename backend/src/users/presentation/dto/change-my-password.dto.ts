import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class ChangeMyPasswordDto {
  @ApiProperty({
    description: 'Mot de passe actuel du compte connecte.',
    minLength: 8,
    maxLength: 64,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  currentPassword!: string;

  @ApiProperty({
    description: 'Nouveau mot de passe a enregistrer.',
    minLength: 8,
    maxLength: 64,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @Length(8, 64, { message: VALIDATION_MESSAGES.PASSWORD_LENGTH })
  newPassword!: string;
}
