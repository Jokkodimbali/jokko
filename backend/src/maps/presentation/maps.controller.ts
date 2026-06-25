import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard';
import { GeocodeAddressUseCase } from '../../geolocation/application/use-cases/geocode-address.use-case';
import { ReverseGeocodeUseCase } from '../../geolocation/application/use-cases/reverse-geocode.use-case';
import { ComputeRoutesUseCase } from '../../routing/application/use-cases/compute-routes.use-case';
import { createApiResponse } from '../../shared/dto/api-response.dto';
import { MapsPublicConfigService } from '../application/maps-public-config.service';
import { ComputeRoutesDto, ReverseGeocodeQueryDto } from './dto/maps.dto';

@ApiTags('Maps')
@Controller('maps')
export class MapsController {
  constructor(
    private readonly mapsConfig: MapsPublicConfigService,
    private readonly geocodeAddress: GeocodeAddressUseCase,
    private readonly reverseGeocodeAddress: ReverseGeocodeUseCase,
    private readonly computeRoutesUseCase: ComputeRoutesUseCase,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Recuperer la configuration publique Google Maps.' })
  getConfig() {
    return createApiResponse(
      this.mapsConfig.getConfig(),
      'Configuration Google Maps recuperee.',
    );
  }

  @Get('geocode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Convertir une adresse en coordonnees GPS Google Maps.',
  })
  async geocode(@Query('address') address = '') {
    const result = await this.geocodeAddress.execute(address);
    return createApiResponse(result, 'Adresse localisee.');
  }

  @Get('reverse-geocode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Convertir des coordonnees GPS en adresse au Senegal.',
  })
  async reverseGeocode(@Query() query: ReverseGeocodeQueryDto) {
    const result = await this.reverseGeocodeAddress.execute(query);
    return createApiResponse(result, 'Coordonnees localisees.');
  }

  @Post('routes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculer un itineraire Google Maps.' })
  async computeRoutes(@Body() body: ComputeRoutesDto) {
    const result = await this.computeRoutesUseCase.execute(body);
    return createApiResponse(result, 'Itineraire calcule.');
  }
}
