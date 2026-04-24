import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { ApiStandardSuccessResponse } from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import {
  EtatSanteDto,
  ObtenirEtatSanteUseCase,
} from '../../application/obtenir-etat-sante.use-case';

@ApiTags(API_DOCS.sante.tag)
@Controller('sante')
export class SanteController {
  constructor(private readonly obtenirEtatSante: ObtenirEtatSanteUseCase) {}

  @Get()
  @ApiOperation({ summary: API_DOCS.sante.statusSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.sante.statusSuccess,
    messageExample: API_DOCS.sante.statusSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.sante.statusData,
    },
  })
  async getEtatSante() {
    const result: EtatSanteDto = await this.obtenirEtatSante.execute();
    return createApiResponse(result, API_DOCS.sante.statusSuccess);
  }
}
