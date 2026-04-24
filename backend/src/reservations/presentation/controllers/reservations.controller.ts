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
import { createApiResponse } from '../../../shared/dto/api-response.dto';
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
  RescheduleReservationDto,
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
    description: 'Service ou professionnel introuvable.',
    errorCode: 'RESERVATIONS_SERVICE_NOT_FOUND',
    messageExample: 'Service introuvable pour cette reservation.',
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: 'Conflit metier sur la reservation.',
    errorCode: 'RESERVATIONS_TIME_SLOT_UNAVAILABLE',
    messageExample: 'Ce creneau horaire n est pas disponible.',
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
    status: 501,
    description: 'Le module de negotiation nest pas encore disponible.',
    errorCode: 'RESERVATIONS_NEGOTIATION_NOT_AVAILABLE',
    messageExample:
      'La reservation depuis une negotiation nest pas encore disponible.',
  })
  async createReservationFromNegotiation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReservationFromNegotiationDto,
  ) {
    const result =
      await this.reservationsFacade.createReservationFromNegotiation(user, dto);
    return createApiResponse(
      result,
      appMessage('RESERVATIONS_CREATED').message,
    );
  }

  @Get('my')
  @ApiOperation({ summary: API_DOCS.reservations.listMineSummary })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filtrer mes reservations par statut',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de debut ISO 8601',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin ISO 8601',
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
    description: 'La reservation doit etre en attente pour etre confirmee.',
    errorCode: 'RESERVATIONS_STATUS_PENDING_REQUIRED',
    messageExample: 'La reservation doit etre en attente pour etre confirmee.',
  })
  async confirmReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.reservationsFacade.confirmReservation(
      user,
      reservationId,
    );
    return createApiResponse(
      result,
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
    description:
      'La reservation ne peut pas etre annulee dans son statut actuel.',
    errorCode: 'RESERVATIONS_ALREADY_CLOSED',
    messageExample:
      'La reservation ne peut pas etre annulee dans son statut actuel.',
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
    description:
      'La reservation ne peut pas etre reprogrammee dans son statut actuel.',
    errorCode: 'RESERVATIONS_TIME_SLOT_UNAVAILABLE',
    messageExample: 'Ce creneau horaire n est pas disponible.',
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
    description: 'La reservation doit etre payee avant d etre finalisee.',
    errorCode: 'RESERVATION_PAYMENT_REQUIRED',
    messageExample:
      'La reservation doit etre payee avant de poursuivre cette action.',
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
    description:
      'La reservation doit etre payee avant d etre marquee en no-show.',
    errorCode: 'RESERVATION_PAYMENT_REQUIRED',
    messageExample:
      'La reservation doit etre payee avant de poursuivre cette action.',
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
    description:
      'La reservation ne peut pas etre marquee comme payee dans son statut actuel.',
    errorCode: 'RESERVATIONS_STATUS_ACTIVE_REQUIRED',
    messageExample: 'La reservation doit etre confirmee ou en cours.',
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
    description: 'La reservation doit etre payee avant d etre demarree.',
    errorCode: 'RESERVATION_PAYMENT_REQUIRED',
    messageExample:
      'La reservation doit etre payee avant de poursuivre cette action.',
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
    description:
      'Impossible d ouvrir un litige dans le statut actuel de la reservation.',
    errorCode: 'RESERVATIONS_STATUS_ACTIVE_REQUIRED',
    messageExample: 'La reservation doit etre confirmee ou en cours.',
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
