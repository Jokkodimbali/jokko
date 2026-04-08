import { IsString, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class GoogleLoginDto {
  @IsString({ message: VALIDATION_MESSAGES.ID_TOKEN_REQUIRED })
  @MinLength(20, { message: VALIDATION_MESSAGES.ID_TOKEN_MIN })
  idToken!: string;
}
