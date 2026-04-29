import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class ListAdminUsersQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.adminUsers.roleFilter,
    enum: RoleUtilisateur,
    example: API_DOCS.adminUsers.roleExample,
  })
  @IsOptional()
  @IsEnum(RoleUtilisateur, {
    message: VALIDATION_MESSAGES.ADMIN_USER_ROLE_INVALID,
  })
  role?: RoleUtilisateur;

  @ApiPropertyOptional({
    description: API_DOCS.adminUsers.isActiveFilter,
    type: Boolean,
    example: API_DOCS.adminUsers.isActiveExample,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.ADMIN_USER_STATUS_INVALID })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: API_DOCS.adminUsers.searchFilter,
    example: API_DOCS.adminUsers.searchExample,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.ADMIN_USER_SEARCH_MAX })
  @MaxLength(100, { message: VALIDATION_MESSAGES.ADMIN_USER_SEARCH_MAX })
  search?: string;

  @ApiPropertyOptional({
    description: API_DOCS.adminUsers.limitField,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: API_DOCS.adminUsers.limitExample,
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
    default: 0,
    minimum: 0,
    example: API_DOCS.adminUsers.offsetExample,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.ADMIN_USER_OFFSET_INVALID })
  @Min(0, { message: VALIDATION_MESSAGES.ADMIN_USER_OFFSET_MIN })
  offset?: number;
}
