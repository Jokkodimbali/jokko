import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
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
import { LiveTrackingFacade } from '../../application/services/live-tracking-facade.service';
import { TrackingLocationDto } from '../dto/tracking-location.dto';

@ApiTags(API_DOCS.liveTracking.tag)
@Controller()
export class LiveTrackingController {
  constructor(private readonly liveTrackingFacade: LiveTrackingFacade) {}

  @Patch('reservations/:reservationId/on-the-way')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.liveTracking.markOnTheWaySummary })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.liveTracking.reservationIdParam,
  })
  @ApiBody({ type: TrackingLocationDto })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.liveTracking.markOnTheWaySuccess,
    messageExample: appMessage('LIVE_TRACKING_ON_THE_WAY_MARKED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.liveTracking.trackingData,
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
    description: API_DOCS.liveTracking.invalidReservationStatus,
    errorCode: 'LIVE_TRACKING_INVALID_RESERVATION_STATUS',
    messageExample: appMessage('LIVE_TRACKING_INVALID_RESERVATION_STATUS')
      .message,
  })
  async markOnTheWay(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() body: TrackingLocationDto,
  ) {
    const result = await this.liveTrackingFacade.markOnTheWay(
      user,
      reservationId,
      body,
    );
    return createApiResponse(
      result,
      appMessage('LIVE_TRACKING_ON_THE_WAY_MARKED').message,
    );
  }

  @Get('reservations/:reservationId/live-tracking')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: API_DOCS.liveTracking.getReservationTrackingSummary,
  })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.liveTracking.reservationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.liveTracking.getReservationTrackingSuccess,
    messageExample: appMessage('LIVE_TRACKING_STATUS_RETRIEVED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.liveTracking.trackingData,
    },
  })
  async getReservationTracking(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.liveTrackingFacade.getReservationTracking(
      user,
      reservationId,
    );
    return createApiResponse(
      result,
      appMessage('LIVE_TRACKING_STATUS_RETRIEVED').message,
    );
  }

  @Patch('reservations/:reservationId/live-tracking/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mettre a jour la position GPS du prestataire en route',
  })
  @ApiParam({
    name: 'reservationId',
    description: API_DOCS.liveTracking.reservationIdParam,
  })
  @ApiBody({ type: TrackingLocationDto })
  @ApiStandardSuccessResponse({
    status: 200,
    description: 'Position GPS enregistree pour le suivi en temps reel.',
    messageExample: appMessage('LIVE_TRACKING_LOCATION_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.liveTracking.trackingData,
    },
  })
  async updateTrackingLocation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() body: TrackingLocationDto,
  ) {
    const result = await this.liveTrackingFacade.updateLocation(
      user,
      reservationId,
      body,
    );
    return createApiResponse(
      result,
      appMessage('LIVE_TRACKING_LOCATION_UPDATED').message,
    );
  }

  @Get('professionals/:professionalId/presence')
  @ApiOperation({
    summary: API_DOCS.liveTracking.getProfessionalPresenceSummary,
  })
  @ApiParam({
    name: 'professionalId',
    description: API_DOCS.liveTracking.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.liveTracking.getProfessionalPresenceSuccess,
    messageExample: appMessage('LIVE_TRACKING_PRESENCE_RETRIEVED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.liveTracking.presenceData,
    },
  })
  async getProfessionalPresence(
    @Param('professionalId') professionalId: string,
  ) {
    const result =
      await this.liveTrackingFacade.getProfessionalPresence(professionalId);
    return createApiResponse(
      result,
      appMessage('LIVE_TRACKING_PRESENCE_RETRIEVED').message,
    );
  }
}
