import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { CategoriesFacade } from '../../application/services/categories-facade.service';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.categories.tag)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesFacade: CategoriesFacade) {}

  @Get()
  @ApiOperation({ summary: API_DOCS.categories.listSummary })
  @ApiResponse({
    status: 200,
    description: API_DOCS.categories.listSuccess,
  })
  async listActive() {
    const result = await this.categoriesFacade.listActiveCategories();
    return createApiResponse(result);
  }
}
