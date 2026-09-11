import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeolocationModule } from '../geolocation/geolocation.module';
import { RoutingModule } from '../routing/routing.module';
import { MapsPublicConfigService } from './application/maps-public-config.service';
import { MapsController } from './presentation/maps.controller';
import { DeliveryPricingService } from './application/delivery-pricing.service';
import { DeliveryPricingSettingsService } from './application/delivery-pricing-settings.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, GeolocationModule, RoutingModule, PrismaModule],
  controllers: [MapsController],
  providers: [MapsPublicConfigService, DeliveryPricingService, DeliveryPricingSettingsService],
  exports: [GeolocationModule, RoutingModule, DeliveryPricingService, DeliveryPricingSettingsService],
})
export class MapsModule {}
