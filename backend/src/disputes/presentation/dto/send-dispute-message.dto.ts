import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';

const DISPUTE_MESSAGE_RECIPIENTS = {
  CLIENT: 'CLIENT',
  PRESTATAIRE: 'PRESTATAIRE',
  TOUS: 'TOUS',
} as const;

export class SendDisputeMessageDto {
  @ApiProperty({
    enum: Object.values(DISPUTE_MESSAGE_RECIPIENTS),
    example: 'TOUS',
  })
  @IsEnum(DISPUTE_MESSAGE_RECIPIENTS)
  recipient!: (typeof DISPUTE_MESSAGE_RECIPIENTS)[keyof typeof DISPUTE_MESSAGE_RECIPIENTS];

  @ApiProperty({
    example:
      "Merci d'envoyer les images demandees afin que la mediation puisse avancer.",
  })
  @IsString()
  @MinLength(2)
  content!: string;
}
