import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createPaginatedResponse } from '../../../shared/dto/api-response.dto';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { SearchQueryService } from '../../application/services/search-query.service';
import { SearchProfessionalsQueryDto } from '../dto/search-professionals-query.dto';

@ApiTags(API_DOCS.search.tag)
@Controller('search')
export class SearchController {
  constructor(private readonly searchQueryService: SearchQueryService) {}

  @Get('professionals')
  @ApiOperation({
    summary: API_DOCS.search.professionalsSummary,
  })
  @ApiQuery({
    name: 'city',
    required: false,
    type: String,
    description: API_DOCS.search.cityFilter,
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: API_DOCS.search.categoryIdFilter,
  })
  @ApiQuery({
    name: 'subCategoryId',
    required: false,
    type: String,
    description: 'Filtre les resultats par sous-categorie de service.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    type: String,
    description: API_DOCS.search.queryFilter,
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['PRESTATAIRE', 'MEDECIN'],
    description: 'Filtre les resultats par type de profil professionnel.',
  })
  @ApiQuery({
    name: 'latitude',
    required: false,
    type: Number,
    description: API_DOCS.search.latitudeFilter,
  })
  @ApiQuery({
    name: 'longitude',
    required: false,
    type: Number,
    description: API_DOCS.search.longitudeFilter,
  })
  @ApiQuery({
    name: 'radiusKm',
    required: false,
    type: Number,
    description: API_DOCS.search.radiusKmFilter,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: API_DOCS.search.pageFilter,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: API_DOCS.search.limitFilter,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.search.professionalsSuccess,
    messageExample: appMessage('SEARCH_RESULTS_RETRIEVED').message,
    dataSchema: {
      type: 'array',
      items: {
        type: 'object',
      },
      example: SWAGGER_RESPONSE_EXAMPLES.search.listData,
    },
    paginated: true,
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.search.coordinatesPairRequired,
    errorCode: 'VALIDATION_REQUEST_INVALID',
    messageExample: API_DOCS.search.coordinatesPairRequired,
  })
  async searchProfessionals(@Query() query: SearchProfessionalsQueryDto) {
    const result = await this.searchQueryService.searchProfessionals({
      city: query.city,
      categoryId: query.categoryId,
      subCategoryId: query.subCategoryId,
      query: query.query,
      role: query.role,
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const response = createPaginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
    response.message = appMessage('SEARCH_RESULTS_RETRIEVED').message;
    return response;
  }
}
