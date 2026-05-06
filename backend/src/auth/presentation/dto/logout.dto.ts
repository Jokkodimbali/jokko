import { IsOptional, IsString, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class LogoutDto {
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.REFRESH_TOKEN_REQUIRED })
  @MinLength(20, { message: VALIDATION_MESSAGES.REFRESH_TOKEN_MIN })
  refreshToken?: string;
}
