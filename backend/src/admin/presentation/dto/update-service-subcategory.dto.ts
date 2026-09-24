import { TypeEspaceProfessionnel } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateServiceSubCategoryDto {
  @ApiProperty({
    enum: TypeEspaceProfessionnel,
    nullable: true,
    required: false,
    description: 'Type d espace specifique, ou null pour heriter de la categorie.',
  })
  @IsOptional()
  @IsEnum(TypeEspaceProfessionnel)
  professionalSpaceType?: TypeEspaceProfessionnel | null;
}
