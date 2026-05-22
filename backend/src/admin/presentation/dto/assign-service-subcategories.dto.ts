import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class AssignServiceSubCategoriesDto {
  @ApiProperty({
    type: [String],
    description: 'Identifiants des sous-categories a rattacher a la categorie.',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  subCategoryIds!: string[];
}

