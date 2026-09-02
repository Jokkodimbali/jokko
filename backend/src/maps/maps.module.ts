import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeolocationModule } from '../geolocation/geolocation.module';
import { RoutingModule } from '../routing/routing.module';
import { MapsPublicConfigService } from './application/maps-public-config.service';
import { MapsController } from './presentation/maps.controller';
import { DeliveryPricingService } from './application/delivery-pricing.service';

@Module({
  imports: [AuthModule, GeolocationModule, RoutingModule],
  controllers: [MapsController],
  providers: [MapsPublicConfigService, DeliveryPricingService],
  exports: [GeolocationModule, RoutingModule, DeliveryPricingService],
})
export class MapsModule {}
