import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { NegotiationsFacade } from '../../application/services/negotiations-facade.service';
import { MaterialQuoteService } from '../../application/services/material-quote.service';
import { CreateNegotiationDto } from '../dto/create-negotiation.dto';
import { ListNegotiationsQueryDto } from '../dto/list-negotiations-query.dto';
import {
  CreateMaterialQuoteDto,
  FinalizeMaterialQuoteDto,
} from '../dto/material-quote.dto';
import {
  CloseNegotiationDto,
  CounterNegotiationDto,
} from '../dto/update-negotiation.dto';
import type { Response } from 'express';

@ApiTags(API_DOCS.negotiations.tag)
@ApiBearerAuth()
@Controller('negotiations')
@UseGuards(JwtAuthGuard)
export class NegotiationsController {
  constructor(
    private readonly negotiationsFacade: NegotiationsFacade,
    private readonly materialQuoteService: MaterialQuoteService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.negotiations.createSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.negotiations.createSuccess,
    messageExample: appMessage('NEGOTIATIONS_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.detailData,
    },
  })
  async createNegotiation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateNegotiationDto,
  ) {
    const result = await this.negotiationsFacade.createNegotiation(user, dto);
    return createApiResponse(
      result,
      appMessage('NEGOTIATIONS_CREATED').message,
    );
  }

  @Get('my')
  @ApiOperation({ summary: API_DOCS.negotiations.listMineSummary })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['CLIENT', 'PRESTATAIRE'],
    description: API_DOCS.negotiations.scopeDescription,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'EN_ATTENTE_PRESTATAIRE',
      'EN_ATTENTE_CLIENT',
      'ACCEPTEE',
      'REFUSEE',
      'ANNULEE',
      'CONVERTIE_EN_RESERVATION',
    ],
    description: API_DOCS.negotiations.statusDescription,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.negotiations.listSuccess,
    messageExample: API_DOCS.negotiations.listSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.listData,
    },
  })
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNegotiationsQueryDto,
  ) {
    const result = await this.negotiationsFacade.listMyNegotiations(
      user,
      query,
    );
    return createApiResponse(result);
  }

  @Get(':negotiationId')
  @ApiOperation({ summary: API_DOCS.negotiations.getByIdSummary })
  @ApiParam({
    name: 'negotiationId',
    description: API_DOCS.negotiations.negotiationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.negotiations.getByIdSuccess,
    messageExample: API_DOCS.negotiations.getByIdSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.detailData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('NEGOTIATIONS_NOT_FOUND').message,
    errorCode: 'NEGOTIATIONS_NOT_FOUND',
    messageExample: appMessage('NEGOTIATIONS_NOT_FOUND').message,
  })
  async getById(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
  ) {
    const result = await this.negotiationsFacade.getNegotiationById(
      user,
      negotiationId,
    );
    return createApiResponse(result);
  }

  @Get(':negotiationId/material-quotes')
  async listMaterialQuotes(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
  ) {
    const result = await this.materialQuoteService.listForNegotiation(
      user,
      negotiationId,
    );
    return createApiResponse(result);
  }

  @Post(':negotiationId/material-quotes')
  @HttpCode(HttpStatus.CREATED)
  async createMaterialQuote(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Body() dto: CreateMaterialQuoteDto,
  ) {
    const result = await this.materialQuoteService.createForNegotiation(
      user,
      negotiationId,
      dto,
    );
    return createApiResponse(result);
  }

  @Patch(':negotiationId/material-quotes/:quoteId/approve')
  async approveMaterialQuote(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Param('quoteId') quoteId: string,
  ) {
    const result = await this.materialQuoteService.approveQuote(
      user,
      negotiationId,
      quoteId,
    );
    return createApiResponse(result);
  }

  @Patch(':negotiationId/material-quotes/:quoteId/reject')
  async rejectMaterialQuote(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Param('quoteId') quoteId: string,
  ) {
    const result = await this.materialQuoteService.rejectQuote(
      user,
      negotiationId,
      quoteId,
    );
    return createApiResponse(result);
  }

  @Post(':negotiationId/material-quotes/finalize')
  async finalizeMaterialQuotes(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Body() dto: FinalizeMaterialQuoteDto,
  ) {
    const result = await this.materialQuoteService.finalizeForReservation(
      user,
      negotiationId,
      dto.reservationId,
    );
    return createApiResponse(result);
  }

  @Get(':negotiationId/material-quotes.pdf')
  async downloadMaterialQuotePdf(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Res() response: Response,
  ) {
    const pdf = await this.materialQuoteService.buildPdfBuffer(
      user,
      negotiationId,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      'inline; filename="devis-materiel.pdf"',
    );
    response.send(pdf);
  }

  @Patch(':negotiationId/counter')
  @ApiOperation({ summary: API_DOCS.negotiations.counterSummary })
  @ApiParam({
    name: 'negotiationId',
    description: API_DOCS.negotiations.negotiationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.negotiations.counterSuccess,
    messageExample: appMessage('NEGOTIATIONS_COUNTERED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.detailData,
    },
  })
  async counter(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Body() dto: CounterNegotiationDto,
  ) {
    const result = await this.negotiationsFacade.counterNegotiation(
      user,
      negotiationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('NEGOTIATIONS_COUNTERED').message,
    );
  }

  @Patch(':negotiationId/accept')
  @ApiOperation({ summary: API_DOCS.negotiations.acceptSummary })
  @ApiParam({
    name: 'negotiationId',
    description: API_DOCS.negotiations.negotiationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.negotiations.acceptSuccess,
    messageExample: appMessage('NEGOTIATIONS_ACCEPTED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.detailData,
    },
  })
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
  ) {
    const result = await this.negotiationsFacade.acceptNegotiation(
      user,
      negotiationId,
    );
    return createApiResponse(
      result,
      appMessage('NEGOTIATIONS_ACCEPTED').message,
    );
  }

  @Patch(':negotiationId/reject')
  @ApiOperation({ summary: API_DOCS.negotiations.rejectSummary })
  @ApiParam({
    name: 'negotiationId',
    description: API_DOCS.negotiations.negotiationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.negotiations.rejectSuccess,
    messageExample: appMessage('NEGOTIATIONS_REJECTED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.detailData,
    },
  })
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Body() dto: CloseNegotiationDto,
  ) {
    const result = await this.negotiationsFacade.rejectNegotiation(
      user,
      negotiationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('NEGOTIATIONS_REJECTED').message,
    );
  }

  @Patch(':negotiationId/cancel')
  @ApiOperation({ summary: API_DOCS.negotiations.cancelSummary })
  @ApiParam({
    name: 'negotiationId',
    description: API_DOCS.negotiations.negotiationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.negotiations.cancelSuccess,
    messageExample: appMessage('NEGOTIATIONS_CANCELLED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.negotiations.detailData,
    },
  })
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('negotiationId') negotiationId: string,
    @Body() dto: CloseNegotiationDto,
  ) {
    const result = await this.negotiationsFacade.cancelNegotiation(
      user,
      negotiationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('NEGOTIATIONS_CANCELLED').message,
    );
  }
}
