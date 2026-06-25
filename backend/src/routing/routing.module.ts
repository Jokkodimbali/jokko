import { Module } from '@nestjs/common';
import { MapsInfrastructureModule } from '../maps/infrastructure/maps-infrastructure.module';
import { ROUTING_PROVIDER_PORT } from './application/ports/routing-provider.port';
import { ComputeRoutesUseCase } from './application/use-cases/compute-routes.use-case';
import { GoogleRoutingAdapter } from './infrastructure/google-routing.adapter';

@Module({
  imports: [MapsInfrastructureModule],
  providers: [
    GoogleRoutingAdapter,
    { provide: ROUTING_PROVIDER_PORT, useExisting: GoogleRoutingAdapter },
    ComputeRoutesUseCase,
  ],
  exports: [ComputeRoutesUseCase],
})
export class RoutingModule {}
