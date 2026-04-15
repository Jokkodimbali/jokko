import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { CategoriesFacade } from '../../application/services/categories-facade.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesFacade: CategoriesFacade) {}

  @Get()
  @ApiOperation({ summary: 'Lister les categories actives' })
  @ApiResponse({
    status: 200,
    description: 'Liste des categories actives recuperee avec succes',
  })
  async listActive() {
    const result = await this.categoriesFacade.listActiveCategories();
    return createApiResponse(result);
  }
}
