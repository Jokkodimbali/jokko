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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { ReservationsFacade } from '../../application/services/reservations-facade.service';
import { CreateReservationFromNegotiationDto } from '../dto/create-reservation-from-negotiation.dto';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ListReservationsQueryDto } from '../dto/list-reservations-query.dto';
import {
  CancelReservationDto,
  RescheduleReservationDto,
} from '../dto/update-reservation.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.reservations.tag)
@ApiBearerAuth()
@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.reservations.createSummary })
  @ApiResponse({
    status: 201,
    description: appMessage('RESERVATIONS_CREATED').message,
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
}
