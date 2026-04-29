import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutKyc } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class ListAdminKycQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.adminKyc.statusFilter,
    enum: StatutKyc,
    example: API_DOCS.adminKyc.statusExample,
  })
  @IsOptional()
  @IsEnum(StatutKyc, { message: VALIDATION_MESSAGES.NON_WHITELISTED_FIELD })
  status?: StatutKyc;

  @ApiPropertyOptional({
    description: API_DOCS.adminUsers.limitField,
    minimum: 1,
    maximum: 100,
    example: API_DOCS.adminKyc.limitExample,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.ADMIN_USER_LIMIT_INVALID })
  @Min(1, { message: VALIDATION_MESSAGES.ADMIN_USER_LIMIT_MIN })
  @Max(100, { message: VALIDATION_MESSAGES.ADMIN_USER_LIMIT_MAX })
  limit?: number;

  @ApiPropertyOptional({
    description: API_DOCS.adminUsers.offsetField,
    minimum: 0,
    example: API_DOCS.adminKyc.offsetExample,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.ADMIN_USER_OFFSET_INVALID })
  @Min(0, { message: VALIDATION_MESSAGES.ADMIN_USER_OFFSET_MIN })
  offset?: number;
}
