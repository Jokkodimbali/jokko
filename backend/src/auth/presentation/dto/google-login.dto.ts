import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class GoogleLoginDto {
  @ApiProperty({
    description: API_DOCS.auth.googleIdTokenField,
    example: 'fake-google-token-xxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsString({ message: VALIDATION_MESSAGES.ID_TOKEN_REQUIRED })
  @MinLength(20, { message: VALIDATION_MESSAGES.ID_TOKEN_MIN })
  idToken!: string;
}
