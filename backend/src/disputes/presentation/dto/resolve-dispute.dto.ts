import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

const DISPUTE_DECISIONS = {
  REMBOURSER_CLIENT: 'REMBOURSER_CLIENT',
  CREDITER_PRESTATAIRE: 'CREDITER_PRESTATAIRE',
  PARTAGER: 'PARTAGER',
} as const;

export class ResolveDisputeDto {
  @ApiProperty({
    description: API_DOCS.disputes.decisionField,
    enum: Object.values(DISPUTE_DECISIONS),
  })
  @IsEnum(DISPUTE_DECISIONS)
  decision!: (typeof DISPUTE_DECISIONS)[keyof typeof DISPUTE_DECISIONS];

  @ApiPropertyOptional({
    description: API_DOCS.disputes.refundPercentageField,
    example: API_DOCS.disputes.refundPercentageExample,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(100)
  clientRefundPercentage?: number;

  @ApiProperty({
    description: API_DOCS.disputes.notesField,
    example: API_DOCS.disputes.resolveNotesExample,
  })
  @IsString()
  @MinLength(10)
  notes!: string;
}

export class RejectDisputeDto {
  @ApiProperty({
    description: API_DOCS.disputes.notesField,
    example: API_DOCS.disputes.rejectNotesExample,
  })
  @IsString()
  @MinLength(10)
  notes!: string;
}
