import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { ReservationsFacade } from '../../application/services/reservations-facade.service';
import { ListReservationsQueryDto } from '../dto/list-reservations-query.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

@ApiTags(API_DOCS.adminReservations.tag)
@ApiBearerAuth()
@Controller('admin/reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminReservations.listSummary })
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
    description: API_DOCS.adminReservations.listSuccess,
    messageExample: API_DOCS.adminReservations.listSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData],
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  async listAllReservations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReservationsQueryDto,
  ) {
    const result = await this.reservationsFacade.getAllReservationsByDateRange(
      user,
      query,
    );
    return createApiResponse(result);
  }

  @Get(':reservationId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminReservations.getByIdSummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.adminReservations.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminReservations.getByIdSuccess,
    messageExample: API_DOCS.adminReservations.getByIdSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.reservationData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.adminReservations.reservationIdParam,
    errorCode: 'RESERVATIONS_NOT_FOUND',
    messageExample: 'Reservation introuvable.',
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

  @Get('statistics')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminReservations.statisticsSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminReservations.statisticsSuccess,
    messageExample: API_DOCS.adminReservations.statisticsSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.reservations.statisticsData,
    },
  })
  async getStatistics(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReservationsQueryDto,
  ) {
    const result = await this.reservationsFacade.getReservationStatistics(
      user,
      query,
    );
    return createApiResponse(result);
  }
}
