import type { RoutingProviderPort } from '../ports/routing-provider.port';
import { ComputeRoutesUseCase } from './compute-routes.use-case';

describe('ComputeRoutesUseCase', () => {
  it('delegates a provider-neutral command to the routing port', async () => {
    const provider = {
      computeRoutes: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<RoutingProviderPort>;
    const useCase = new ComputeRoutesUseCase(provider);

    await useCase.execute({
      origin: { latitude: 14.7167, longitude: -17.4677 },
      destination: { latitude: 14.6937, longitude: -17.4441 },
    });

    expect(provider.computeRoutes).toHaveBeenCalledWith({
      origin: { latitude: 14.7167, longitude: -17.4677 },
      destination: { latitude: 14.6937, longitude: -17.4441 },
      alternatives: true,
    });
  });

  it('rejects coordinates outside Senegal before calling Google', async () => {
    const provider = {
      computeRoutes: jest.fn(),
    } as unknown as jest.Mocked<RoutingProviderPort>;
    const useCase = new ComputeRoutesUseCase(provider);

    expect(() =>
      useCase.execute({
        origin: { latitude: 48.8566, longitude: 2.3522 },
        destination: { latitude: 14.6937, longitude: -17.4441 },
      }),
    ).toThrow();
    expect(provider.computeRoutes).not.toHaveBeenCalled();
  });
});
