import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { RoleUtilisateur } from '@prisma/client';
import { ReservationsFacade } from '../../application/services/reservations-facade.service';
import { ListReservationsQueryDto } from '../dto/list-reservations-query.dto';

@Controller('admin/reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminReservationsController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  async listAllReservations(@Query() query: ListReservationsQueryDto) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    if (!startDate || !endDate) {
      return [];
    }

    return await this.reservationsFacade.getAllReservationsByDateRange(
      startDate,
      endDate,
    );
  }

  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN)
  async getReservation(@Param('id') id: string) {
    return await this.reservationsFacade.getReservationById(id);
  }
}
