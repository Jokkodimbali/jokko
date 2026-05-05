import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createPaginatedResponse } from '../../../shared/dto/api-response.dto';
import { CategoriesFacade } from '../../application/services/categories-facade.service';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { ApiStandardSuccessResponse } from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

@ApiTags(API_DOCS.categories.tag)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesFacade: CategoriesFacade) {}

  @Get()
  @ApiOperation({ summary: API_DOCS.categories.listSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.categories.listSuccess,
    messageExample: API_DOCS.categories.listSuccess,
    dataSchema: {
      type: 'array',
      items: {
        type: 'object',
      },
      example: SWAGGER_RESPONSE_EXAMPLES.categories.listData,
    },
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listActive(@Query('page') page?: string, @Query('limit') limit?: string) {
    const p = page ? parseInt(page) : 1;
    const l = limit ? parseInt(limit) : 10;
    const result = await this.categoriesFacade.listActiveCategories(p, l);
    return createPaginatedResponse(result.items, result.total, p, l);
  }
}
