import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

const DISPUTE_STATUSES = {
  OUVERT: 'OUVERT',
  EN_REVUE: 'EN_REVUE',
  RESOLU: 'RESOLU',
  REJETE: 'REJETE',
} as const;

const DISPUTE_PRIORITIES = {
  BASSE: 'BASSE',
  MOYENNE: 'MOYENNE',
  HAUTE: 'HAUTE',
} as const;

export class ListDisputesQueryDto {
  @ApiPropertyOptional({
    description: API_DOCS.disputes.statusFilter,
    enum: Object.values(DISPUTE_STATUSES),
  })
  @IsOptional()
  @IsEnum(DISPUTE_STATUSES)
  status?: (typeof DISPUTE_STATUSES)[keyof typeof DISPUTE_STATUSES];

  @ApiPropertyOptional({
    description: API_DOCS.disputes.priorityFilter,
    enum: Object.values(DISPUTE_PRIORITIES),
  })
  @IsOptional()
  @IsEnum(DISPUTE_PRIORITIES)
  priority?: (typeof DISPUTE_PRIORITIES)[keyof typeof DISPUTE_PRIORITIES];

  @ApiPropertyOptional({
    description: API_DOCS.disputes.limitField,
    example: API_DOCS.disputes.limitExample,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: API_DOCS.disputes.cursorField,
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
