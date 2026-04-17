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

@ApiTags('Admin - Reservations')
@ApiBearerAuth()
@Controller('admin/reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Lister les reservations sur une plage de dates' })
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
  @ApiOperation({ summary: 'Recuperer une reservation par son identifiant' })
  @ApiParam({
    name: 'reservationId',
    description: 'Identifiant de la reservation',
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
}
