import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class OpenDisputeDto {
  @ApiProperty({
    description: 'Motif du litige sur la reservation',
    example: 'Le prestataire ne sest pas presente au rendez-vous.',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
