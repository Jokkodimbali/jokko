import type { ConfigService } from '@nestjs/config';
import { GeoapifyApiClient } from './geoapify-api.client';

describe('GeoapifyApiClient', () => {
  const originalFetch = global.fetch;
  let client: GeoapifyApiClient;
  let request: jest.Mock;

  beforeEach(() => {
    client = new GeoapifyApiClient({
      get: () => 'test-key',
    } as unknown as ConfigService);
    request = jest.fn();
    global.fetch = request;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('geocodes only in Senegal and normalizes the public address shape', async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            lat: 14.7167,
            lon: -17.4677,
            formatted: 'Dakar, Senegal',
            place_id: 'place-1',
          },
        ],
      }),
    });
    await expect(client.geocodeAddress('Dakar')).resolves.toEqual({
      latitude: 14.7167,
      longitude: -17.4677,
      formattedAddress: 'Dakar, Senegal',
      placeId: 'place-1',
    });
    const url = new URL(request.mock.calls[0][0] as string);
    expect(url.searchParams.get('filter')).toBe('countrycode:sn');
    expect(url.searchParams.get('text')).toBe('Dakar');
  });

  it('maps route geometry and instructions into the existing route contract', async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: {
              coordinates: [
                [
                  [-17.47, 14.71],
                  [-17.46, 14.72],
                ],
              ],
            },
            properties: {
              distance: 1800,
              time: 360,
              polyline5: 'encoded',
              legs: [
                {
                  steps: [
                    {
                      distance: 1800,
                      time: 360,
                      from_index: 0,
                      to_index: 1,
                      instruction: { text: 'Tournez à droite', type: 'Right' },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    });
    const routes = await client.computeRoutes({
      origin: { latitude: 14.71, longitude: -17.47 },
      destination: { latitude: 14.72, longitude: -17.46 },
      alternatives: true,
    });
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      distanceMeters: 1800,
      durationSeconds: 360,
      encodedPolyline: 'encoded',
      navigationSteps: [{ instruction: 'Tournez à droite', maneuver: 'Right' }],
    });
    expect(routes[0].coordinates).toEqual([
      { latitude: 14.71, longitude: -17.47 },
      { latitude: 14.72, longitude: -17.46 },
    ]);
    const url = new URL(request.mock.calls[0][0] as string);
    expect(url.searchParams.get('traffic')).toBe('approximated');
    expect(url.searchParams.get('type')).toBe('balanced');
    expect(url.searchParams.has('alternatives')).toBe(false);
    expect(request).toHaveBeenCalledTimes(3);
    expect(
      new URL(request.mock.calls[1][0] as string).searchParams.get('type'),
    ).toBe('short');
    expect(
      new URL(request.mock.calls[2][0] as string).searchParams.get('type'),
    ).toBe('less_maneuvers');
  });

  it('requests only the primary route when alternatives are disabled', async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    await expect(
      client.computeRoutes({
        origin: { latitude: 14.71, longitude: -17.47 },
        destination: { latitude: 14.72, longitude: -17.46 },
        alternatives: false,
      }),
    ).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps distinct alternatives and preserves the primary route if an alternative fails', async () => {
    const feature = (latitude: number, longitude: number) => ({
      geometry: {
        coordinates: [
          [
            [longitude, latitude],
            [-17.46, 14.72],
          ],
        ],
      },
      properties: { distance: 1800, time: 360, legs: [] },
    });
    request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ features: [feature(14.71, -17.47)] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ features: [feature(14.715, -17.475)] }),
      })
      .mockRejectedValueOnce(new Error('secondary route unavailable'));
    const routes = await client.computeRoutes({
      origin: { latitude: 14.71, longitude: -17.47 },
      destination: { latitude: 14.72, longitude: -17.46 },
      alternatives: true,
    });
    expect(routes.map((route) => route.id)).toEqual(['route-0', 'route-1']);
    expect(routes[0].coordinates[0]).toEqual({
      latitude: 14.71,
      longitude: -17.47,
    });
    expect(routes[1].coordinates[0]).toEqual({
      latitude: 14.715,
      longitude: -17.475,
    });
  });
});
