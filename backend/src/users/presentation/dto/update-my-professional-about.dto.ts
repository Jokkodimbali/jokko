import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMyProfessionalAboutDto {
  @ApiProperty({
    description:
      'Texte de presentation professionnelle affiche dans le profil.',
    example:
      "Chirurgien dentiste avec plus de 8 ans d'experience, specialise dans les soins pediatriques.",
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  about!: string;
}
