import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertMyProfessionalExpertiseDto {
  @ApiProperty({
    description: 'Expertise ou acte professionnel a ajouter ou retirer.',
    example: 'Chirurgie dentaire pediatrique',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
