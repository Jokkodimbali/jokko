import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
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
  async listActive() {
    const result = await this.categoriesFacade.listActiveCategories();
    return createApiResponse(result);
  }
}
