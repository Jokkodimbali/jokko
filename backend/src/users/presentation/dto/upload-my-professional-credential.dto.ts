import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadMyProfessionalCredentialDto {
  @ApiPropertyOptional({
    description: 'Titre du diplome ou certificat.',
    example: 'Diplome de medecine generale',
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({
    description: 'Etablissement ayant delivre le document.',
    example: 'Universite Cheikh Anta Diop',
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  institution?: string;

  @ApiPropertyOptional({
    description: 'Promotion ou annee d obtention.',
    example: '2021',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  graduationYear?: string;

  @ApiPropertyOptional({
    description: 'Numero de reference du document.',
    example: 'REF-MED-2021-0042',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceNumber?: string;
}
