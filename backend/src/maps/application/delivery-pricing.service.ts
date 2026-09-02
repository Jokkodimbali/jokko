import { BadRequestException, Injectable } from '@nestjs/common';
import { GeocodeAddressUseCase } from '../../geolocation/application/use-cases/geocode-address.use-case';
import { ComputeRoutesUseCase } from '../../routing/application/use-cases/compute-routes.use-case';

export type DeliveryQuote = { distanceKm: number; amount: number };

@Injectable()
export class DeliveryPricingService {
  constructor(
    private readonly geocodeAddress: GeocodeAddressUseCase,
    private readonly computeRoutes: ComputeRoutesUseCase,
  ) {}

  async quote(input: {
    pickupAddress: string;
    dropoffAddress: string;
    pricePerKm: number;
    minimumAmount?: number;
    locationErrorLabel?: string;
  }): Promise<DeliveryQuote> {
    const [pickup, dropoff] = await Promise.all([
      this.geocodeAddress.execute(input.pickupAddress),
      this.geocodeAddress.execute(input.dropoffAddress),
    ]);
    if (!pickup || !dropoff) {
      throw new BadRequestException(
        input.locationErrorLabel ??
          'Impossible de localiser les adresses pour calculer la livraison.',
      );
    }
    const routes = await this.computeRoutes.execute({
      origin: pickup,
      destination: dropoff,
      alternatives: false,
    });
    const distanceMeters = routes.find(
      (route) => Number(route.distanceMeters) > 0,
    )?.distanceMeters;
    if (!distanceMeters) {
      throw new BadRequestException(
        'Impossible de calculer la distance de livraison.',
      );
    }
    const distanceKm = distanceMeters / 1000;
    return {
      distanceKm,
      amount: Math.max(
        input.minimumAmount ?? 500,
        Math.round(distanceKm * input.pricePerKm),
      ),
    };
  }
}
