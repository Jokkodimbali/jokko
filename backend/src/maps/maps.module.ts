import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeolocationModule } from '../geolocation/geolocation.module';
import { RoutingModule } from '../routing/routing.module';
import { MapsPublicConfigService } from './application/maps-public-config.service';
import { MapsController } from './presentation/maps.controller';

@Module({
  imports: [AuthModule, GeolocationModule, RoutingModule],
  controllers: [MapsController],
  providers: [MapsPublicConfigService],
  exports: [GeolocationModule, RoutingModule],
})
export class MapsModule {}
