import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { UserRoleVO } from '../../../professionals/domain/value-objects/user-role.vo';
import {
  ReservationsFacade,
  CreateReservationFromNegotiationDto as CreateReservationFromNegotiationInput,
} from '../../application/services/reservations-facade.service';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import {
  CancelReservationDto,
  RescheduleReservationDto,
} from '../dto/update-reservation.dto';
import { CreateReservationFromNegotiationDto } from '../dto/create-reservation-from-negotiation.dto';

import { ListReservationsQueryDto } from '../dto/list-reservations-query.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { appMessage } from '../../../core/http/app-messages';

@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Post()
  async createReservation(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.reservationsFacade.createReservation({
      clientId: user.sub,
      professionnelId: dto.professionnelId,
      serviceId: dto.serviceId,
      dateHeure: new Date(dto.dateHeure),
      dureeMinutes: dto.dureeMinutes,
      notes: dto.notes,
    });

    // If service requires negotiation, return appropriate response
    if ('requiresNegotiation' in result) {
      return {
        status: 'negotiation_required',
        serviceId: result.serviceId,
        message: appMessage('RESERVATIONS_NEGOTIATION_REQUIRED').message,
      };
    }

    return createApiResponse(
      result,
      appMessage('RESERVATIONS_CREATED').message,
    );
  }

  @Post('from-negotiation')
  async createReservationFromNegotiation(
    @Body() dto: CreateReservationFromNegotiationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const facadeInput: CreateReservationFromNegotiationInput = {
      negotiationId: dto.negotiationId,
      userId: user.sub,
      dateHeure: new Date(dto.dateHeure),
      dureeMinutes: dto.dureeMinutes,
      notes: dto.notes,
    };

    const result =
      await this.reservationsFacade.createReservationFromNegotiation(
        facadeInput,
      );
    return result;
  }

  @Get('my')
  async getMyReservations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReservationsQueryDto,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    if (UserRoleVO.create(user.role).isProfessional()) {
      if (startDate && endDate) {
        return await this.reservationsFacade.getProfessionalReservationsByDateRange(
          user.sub,
          startDate,
          endDate,
        );
      }
      return await this.reservationsFacade.getProfessionalReservations(
        user.sub,
      );
    }

    return await this.reservationsFacade.getClientReservations(user.sub);
  }

  @Get(':id')
  async getReservation(@Param('id') id: string) {
    return await this.reservationsFacade.getReservationById(id);
  }

  @Patch(':id/confirm')
  async confirmReservation(
    @Param('id') reservationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const isProfessional = UserRoleVO.create(user.role).isProfessional();
    return await this.reservationsFacade.confirmReservation(
      reservationId,
      user.sub,
      isProfessional,
    );
  }

  @Patch(':id/cancel')
  async cancelReservation(
    @Body() dto: CancelReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const isProfessional = UserRoleVO.create(user.role).isProfessional();
    return await this.reservationsFacade.cancelReservation(
      dto.reservationId,
      user.sub,
      isProfessional,
      dto.reason || "Annulé par l'utilisateur",
    );
  }

  @Patch(':id/reschedule')
  async rescheduleReservation(
    @Body() dto: RescheduleReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const isProfessional = UserRoleVO.create(user.role).isProfessional();
    return await this.reservationsFacade.rescheduleReservation(
      dto.reservationId,
      user.sub,
      isProfessional,
      new Date(dto.newDateTime),
    );
  }

  @Patch(':id/complete')
  async completeReservation(
    @Param('id') reservationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return await this.reservationsFacade.completeReservation(
      reservationId,
      user.sub,
    );
  }

  @Patch(':id/no-show')
  async markNoShow(
    @Param('id') reservationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return await this.reservationsFacade.markNoShow(reservationId, user.sub);
  }
}
