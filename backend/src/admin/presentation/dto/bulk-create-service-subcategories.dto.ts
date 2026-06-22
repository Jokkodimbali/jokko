import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateServiceSubCategoryDto } from './create-service-subcategory.dto';

export class BulkCreateServiceSubCategoriesDto {
  @ApiProperty({
    type: [CreateServiceSubCategoryDto],
    minItems: 1,
    maxItems: 200,
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateServiceSubCategoryDto)
  subCategories!: CreateServiceSubCategoryDto[];
}
