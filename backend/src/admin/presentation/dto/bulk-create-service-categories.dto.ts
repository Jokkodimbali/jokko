import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateCategoryDto } from '../../../categories/presentation/dto/create-category.dto';

export class BulkCreateServiceCategoriesDto {
  @ApiProperty({ type: [CreateCategoryDto], minItems: 1, maxItems: 100 })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateCategoryDto)
  categories!: CreateCategoryDto[];
}
