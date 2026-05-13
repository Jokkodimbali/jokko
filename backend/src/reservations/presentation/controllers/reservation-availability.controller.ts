import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { ReservationsFacade } from '../../application/services/reservations-facade.service';
import { CheckReservationAvailabilityQueryDto } from '../dto/check-reservation-availability.dto';
import { ListReservationAvailabilitySlotsQueryDto } from '../dto/list-reservation-availability-slots.dto';

@ApiTags(API_DOCS.reservations.tag)
@Controller('reservations/availability')
export class ReservationAvailabilityController {
  constructor(private readonly reservationsFacade: ReservationsFacade) {}

  @Get('slots')
  @ApiOperation({ summary: 'Lister les creneaux disponibles dun prestataire' })
  async listAvailabilitySlots(
    @Query() query: ListReservationAvailabilitySlotsQueryDto,
  ) {
    const result = await this.reservationsFacade.listAvailabilitySlots(query);
    return createApiResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'Verifier la disponibilite dun creneau' })
  async checkAvailability(
    @Query() query: CheckReservationAvailabilityQueryDto,
  ) {
    const result = await this.reservationsFacade.checkAvailability(query);
    return createApiResponse(result);
  }
}
