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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import {
  createApiResponse,
  createPaginatedResponse,
} from '../../../shared/dto/api-response.dto';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { ReservationsFacade } from '../../application/services/reservations-facade.service';
import { CreateReservationFromNegotiationDto } from '../dto/create-reservation-from-negotiation.dto';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ListReservationsQueryDto } from '../dto/list-reservations-query.dto';
import { OpenDisputeDto } from '../dto/open-dispute.dto';
import {
  CancelReservationDto,
  ProposeReservationPriceAdjustmentDto,
  RescheduleReservationDto,
  SubmitReservationReviewDto,
} from '../dto/update-reservation.dto';

@ApiTags(API_DOCS.reservations.tag)
@ApiBearerAuth()
@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.reservations.createSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.reservations.createSuccess,
    messageExample: appMessage('RESERVATIONS_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.common.validationBadRequest,
    errorCode: 'VALIDATION_REQUEST_INVALID',
    messageExample: API_DOCS.common.validationBadRequest,
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.reservations.createNotFound,
    errorCode: 'RESERVATIONS_SERVICE_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_SERVICE_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.createConflict,
    errorCode: 'RESERVATIONS_TIME_SLOT_UNAVAILABLE',
    messageExample: appMessage('RESERVATIONS_TIME_SLOT_UNAVAILABLE').message,
  })
  async createReservation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReservationDto,
  ) {
    const result = await this.reservationsFacade.createReservation(user, dto);
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_CREATED').message,
    );
  }

  @Post('from-negotiation')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.reservations.createFromNegotiationSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.reservations.createFromNegotiationSuccess,
    messageExample: appMessage('RESERVATIONS_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.common.validationBadRequest,
    errorCode: 'VALIDATION_REQUEST_INVALID',
    messageExample: API_DOCS.common.validationBadRequest,
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('NEGOTIATIONS_NOT_FOUND').message,
    errorCode: 'NEGOTIATIONS_NOT_FOUND',
    messageExample: appMessage('NEGOTIATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: appMessage('NEGOTIATIONS_ACCEPTED_REQUIRED').message,
    errorCode: 'NEGOTIATIONS_ACCEPTED_REQUIRED',
    messageExample: appMessage('NEGOTIATIONS_ACCEPTED_REQUIRED').message,
  })
  async createReservationFromNegotiation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReservationFromNegotiationDto,
  ) {
    const result =
      await this.reservationsFacade.createReservationFromNegotiation(user, dto);
    return createApiResponse(
      result,
      API_DOCS.reservations.createFromNegotiationSuccess,
    );
  }

  @Get('my')
  @ApiOperation({ summary: API_DOCS.reservations.listMineSummary })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: API_DOCS.reservations.statusField,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: API_DOCS.reservations.startDateField,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: API_DOCS.reservations.endDateField,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre maximum de rendez-vous a retourner.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Nombre de rendez-vous a ignorer avant la page courante.',
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.listMineSuccess,
    messageExample: API_DOCS.reservations.listMineSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.listData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  async getMyReservations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReservationsQueryDto,
  ) {
    if (query.limit !== undefined || query.offset !== undefined) {
      const result = await this.reservationsFacade.getMyReservationsPage(
        user,
        query,
      );
      const page = Math.floor(result.offset / result.limit) + 1;
      return createPaginatedResponse(
        result.items,
        result.total,
        page,
        result.limit,
      );
    }

    const result = await this.reservationsFacade.getMyReservations(user, query);
    return createApiResponse(result);
  }

  @Get(':reservationId')
  @ApiOperation({ summary: API_DOCS.reservations.getByIdSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.getByIdSuccess,
    messageExample: API_DOCS.reservations.getByIdSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  async getReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.getReservationById(
      user,
      reservationId,
    );
    return createApiResponse(result);
  }

  @Patch(':reservationId/confirm')
  @ApiOperation({ summary: API_DOCS.reservations.confirmSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.confirmSuccess,
    messageExample: appMessage('RESERVATIONS_CONFIRMED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.confirmPendingRequired,
    errorCode: 'RESERVATIONS_STATUS_PENDING_REQUIRED',
    messageExample: API_DOCS.reservations.confirmPendingRequired,
  })
  async confirmReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    this.reservationsFacade.confirmReservation(user, reservationId);
    return createApiResponse(
      null,
      appMessage('RESERVATIONS_CONFIRMED').message,
    );
  }

  @Patch(':reservationId/cancel')
  @ApiOperation({ summary: API_DOCS.reservations.cancelSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.cancelSuccess,
    messageExample: appMessage('RESERVATIONS_CANCELLED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'ANNULEE',
        raisonAnnulation: 'Indisponibilite du client',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.cancelConflict,
    errorCode: 'RESERVATIONS_ALREADY_CLOSED',
    messageExample: API_DOCS.reservations.cancelConflict,
  })
  async cancelReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: CancelReservationDto,
  ) {
    const result = await this.reservationsFacade.cancelReservation(
      user,
      reservationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_CANCELLED').message,
    );
  }

  @Patch(':reservationId/reschedule')
  @ApiOperation({ summary: API_DOCS.reservations.rescheduleSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.rescheduleSuccess,
    messageExample: appMessage('RESERVATIONS_RESCHEDULED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        dateHeure: '2026-05-02T14:00:00.000Z',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.rescheduleConflict,
    errorCode: 'RESERVATIONS_TIME_SLOT_UNAVAILABLE',
    messageExample: appMessage('RESERVATIONS_TIME_SLOT_UNAVAILABLE').message,
  })
  async rescheduleReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: RescheduleReservationDto,
  ) {
    const result = await this.reservationsFacade.rescheduleReservation(
      user,
      reservationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_RESCHEDULED').message,
    );
  }

  @Patch(':reservationId/price-adjustment/propose')
  @ApiOperation({
    summary: API_DOCS.reservations.proposePriceAdjustmentSummary,
  })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiBody({ type: ProposeReservationPriceAdjustmentDto })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.proposePriceAdjustmentSuccess,
    messageExample: appMessage('RESERVATIONS_PRICE_ADJUSTMENT_PROPOSED')
      .message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'CONFIRMEE',
        prixConvenu: 25000,
        statutAjustementPrix: 'EN_ATTENTE_CLIENT',
        prixAjustementPropose: 32000,
        raisonAjustementPrix: 'Travaux supplementaires constates sur place',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.priceAdjustmentConflict,
    errorCode: 'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
    messageExample: appMessage(
      'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
    ).message,
  })
  async proposePriceAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: ProposeReservationPriceAdjustmentDto,
  ) {
    const result = await this.reservationsFacade.proposePriceAdjustment(
      user,
      reservationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_PRICE_ADJUSTMENT_PROPOSED').message,
    );
  }

  @Patch(':reservationId/price-adjustment/accept')
  @ApiOperation({
    summary: API_DOCS.reservations.acceptPriceAdjustmentSummary,
  })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.acceptPriceAdjustmentSuccess,
    messageExample: appMessage('RESERVATIONS_PRICE_ADJUSTMENT_ACCEPTED')
      .message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'CONFIRMEE',
        prixConvenu: 32000,
        statutAjustementPrix: 'ACCEPTE',
        prixAjustementPropose: 32000,
      },
    },
  })
  async acceptPriceAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.acceptPriceAdjustment(
      user,
      reservationId,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_PRICE_ADJUSTMENT_ACCEPTED').message,
    );
  }

  @Patch(':reservationId/price-adjustment/reject')
  @ApiOperation({
    summary: API_DOCS.reservations.rejectPriceAdjustmentSummary,
  })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.rejectPriceAdjustmentSuccess,
    messageExample: appMessage('RESERVATIONS_PRICE_ADJUSTMENT_REJECTED')
      .message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'CONFIRMEE',
        prixConvenu: 25000,
        statutAjustementPrix: 'REFUSE',
        prixAjustementPropose: 32000,
      },
    },
  })
  async rejectPriceAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.rejectPriceAdjustment(
      user,
      reservationId,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_PRICE_ADJUSTMENT_REJECTED').message,
    );
  }

  @Patch(':reservationId/complete')
  @ApiOperation({ summary: API_DOCS.reservations.completeSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.completeSuccess,
    messageExample: appMessage('RESERVATIONS_COMPLETED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'TERMINEE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.completePaymentRequired,
    errorCode: 'RESERVATION_PAYMENT_REQUIRED',
    messageExample: API_DOCS.reservations.completePaymentRequired,
  })
  async completeReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.completeReservation(
      user,
      reservationId,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_COMPLETED').message,
    );
  }

  @Patch(':reservationId/review')
  @ApiOperation({ summary: API_DOCS.reservations.submitReviewSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiBody({ type: SubmitReservationReviewDto })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.submitReviewSuccess,
    messageExample: appMessage('RESERVATIONS_REVIEW_SUBMITTED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'TERMINEE',
        clientRating: 5,
        clientReview: 'Prestation tres propre et ponctuelle.',
        clientReviewedAt: '2026-05-01T12:00:00.000Z',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.reservations.reviewCompletedRequired,
    errorCode: 'RESERVATION_REVIEW_REQUIRES_COMPLETED',
    messageExample: API_DOCS.reservations.reviewCompletedRequired,
  })
  async submitReview(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: SubmitReservationReviewDto,
  ) {
    const result = await this.reservationsFacade.submitReview(
      user,
      reservationId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_REVIEW_SUBMITTED').message,
    );
  }

  @Patch(':reservationId/no-show')
  @ApiOperation({ summary: API_DOCS.reservations.noShowSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.noShowSuccess,
    messageExample: appMessage('RESERVATIONS_NO_SHOW_MARKED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'NO_SHOW',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.noShowPaymentRequired,
    errorCode: 'RESERVATION_PAYMENT_REQUIRED',
    messageExample: API_DOCS.reservations.noShowPaymentRequired,
  })
  async markNoShow(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.markNoShow(
      user,
      reservationId,
    );
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_NO_SHOW_MARKED').message,
    );
  }

  @Patch(':reservationId/mark-paid')
  @ApiOperation({ summary: API_DOCS.reservations.markPaidSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.markPaidSuccess,
    messageExample: API_DOCS.reservations.markPaidSuccess,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'PAYEE_SEQUESTRE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.markPaidConflict,
    errorCode: 'RESERVATIONS_STATUS_ACTIVE_REQUIRED',
    messageExample: appMessage('RESERVATIONS_STATUS_ACTIVE_REQUIRED').message,
  })
  async markAsPaid(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.markAsPaid(
      user,
      reservationId,
    );
    return createApiResponse(result, API_DOCS.reservations.markPaidSuccess);
  }

  @Patch(':reservationId/start')
  @ApiOperation({ summary: API_DOCS.reservations.startSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.startSuccess,
    messageExample: API_DOCS.reservations.startSuccess,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'EN_COURS',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.startPaymentRequired,
    errorCode: 'RESERVATION_PAYMENT_REQUIRED',
    messageExample: API_DOCS.reservations.startPaymentRequired,
  })
  async startReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.startReservation(
      user,
      reservationId,
    );
    return createApiResponse(result, API_DOCS.reservations.startSuccess);
  }

  @Patch(':reservationId/dispute')
  @ApiOperation({ summary: API_DOCS.reservations.disputeSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.reservations.reservationIdParam,
  })
  @ApiBody({ type: OpenDisputeDto })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.reservations.disputeSuccess,
    messageExample: API_DOCS.reservations.disputeSuccess,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
        statut: 'LITIGE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('RESERVATIONS_NOT_FOUND').message,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: appMessage('RESERVATIONS_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.reservations.disputeConflict,
    errorCode: 'RESERVATIONS_STATUS_ACTIVE_REQUIRED',
    messageExample: appMessage('RESERVATIONS_STATUS_ACTIVE_REQUIRED').message,
  })
  async openDispute(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() body: OpenDisputeDto,
  ) {
    const result = await this.reservationsFacade.openDispute(
      user,
      reservationId,
      body.reason,
    );
    return createApiResponse(result, API_DOCS.reservations.disputeSuccess);
  }
}
