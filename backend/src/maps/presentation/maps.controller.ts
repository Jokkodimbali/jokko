import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard';
import { GeocodeAddressUseCase } from '../../geolocation/application/use-cases/geocode-address.use-case';
import { ReverseGeocodeUseCase } from '../../geolocation/application/use-cases/reverse-geocode.use-case';
import { AutocompleteAddressesUseCase } from '../../geolocation/application/use-cases/autocomplete-addresses.use-case';
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
    private readonly autocompleteAddresses: AutocompleteAddressesUseCase,
  ) {}

  @Get('config')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Recuperer la configuration publique du fournisseur de cartes.',
  })
  getConfig() {
    return createApiResponse(
      this.mapsConfig.getConfig(),
      'Configuration des cartes recuperee.',
    );
  }

  @Get('autocomplete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proposer des adresses au Senegal.' })
  async autocomplete(@Query('text') text = '') {
    return createApiResponse(
      await this.autocompleteAddresses.execute(text),
      'Suggestions recuperees.',
    );
  }

  @Get('geocode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Convertir une adresse en coordonnees GPS.',
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
  @ApiOperation({ summary: 'Calculer un itineraire.' })
  async computeRoutes(@Body() body: ComputeRoutesDto) {
    const result = await this.computeRoutesUseCase.execute(body);
    return createApiResponse(result, 'Itineraire calcule.');
  }
}
