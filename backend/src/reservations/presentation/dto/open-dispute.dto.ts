import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class OpenDisputeDto {
  @ApiProperty({
    description: API_DOCS.reservations.disputeReasonField,
    example: 'Le prestataire ne sest pas presente au rendez-vous.',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
