import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class AppleLoginDto {
  @ApiProperty({
    description: API_DOCS.auth.appleIdTokenField,
    example: 'eyJraWQiOiJ...apple-identity-token',
  })
  @IsString({ message: VALIDATION_MESSAGES.ID_TOKEN_REQUIRED })
  @MinLength(20, { message: VALIDATION_MESSAGES.ID_TOKEN_MIN })
  idToken!: string;

  @ApiPropertyOptional({
    description: API_DOCS.auth.appleNameField,
    example: 'Awa Ndiaye',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
