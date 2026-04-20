import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
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

@ApiTags(API_DOCS.adminReservations.tag)
@ApiBearerAuth()
@Controller('admin/reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminReservations.listSummary })
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
  @ApiOperation({ summary: 'Obtenir les statistiques des réservations' })
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
