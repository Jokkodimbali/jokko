import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MapsPublicConfigService {
  constructor(private readonly configService: ConfigService) {}

  getConfig() {
    const browserApiKey = this.configService
      .get<string>('GOOGLE_MAPS_BROWSER_API_KEY')
      ?.trim();
    const developmentFallback =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? ''
        : this.configService.get<string>('GOOGLE_MAPS_API_KEY')?.trim() || '';

    return {
      browserApiKey: browserApiKey || developmentFallback,
      mapId:
        this.configService.get<string>('GOOGLE_MAPS_MAP_ID')?.trim() ||
        'DEMO_MAP_ID',
      countryCode: 'SN',
      language: 'fr',
    };
  }
}
