import { TypeEspaceProfessionnel } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class ApplyCategorySpaceDto {
  @ApiProperty({
    enum: TypeEspaceProfessionnel,
    description: 'Type d espace a appliquer a toutes les sous-categories de la categorie.',
  })
  @IsEnum(TypeEspaceProfessionnel)
  professionalSpaceType!: TypeEspaceProfessionnel;
}
