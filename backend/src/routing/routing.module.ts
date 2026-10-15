import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapsInfrastructureModule } from '../maps/infrastructure/maps-infrastructure.module';
import { ROUTING_PROVIDER_PORT } from './application/ports/routing-provider.port';
import { ComputeRoutesUseCase } from './application/use-cases/compute-routes.use-case';
import { GoogleRoutingAdapter } from './infrastructure/google-routing.adapter';
import { GeoapifyRoutingAdapter } from './infrastructure/geoapify-routing.adapter';

@Module({
  imports: [MapsInfrastructureModule],
  providers: [
    GoogleRoutingAdapter,
    GeoapifyRoutingAdapter,
    {
      provide: ROUTING_PROVIDER_PORT,
      inject: [ConfigService, GoogleRoutingAdapter, GeoapifyRoutingAdapter],
      useFactory: (
        config: ConfigService,
        google: GoogleRoutingAdapter,
        geoapify: GeoapifyRoutingAdapter,
      ) =>
        config.get<string>('MAP_PROVIDER') === 'geoapify' ? geoapify : google,
    },
    ComputeRoutesUseCase,
  ],
  exports: [ComputeRoutesUseCase],
})
export class RoutingModule {}
