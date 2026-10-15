import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appHttpException } from '../../../core/http/app-http.exception';
import type {
  GeocodedAddress,
  MapRoute,
} from '../../domain/models/map-route.model';
import {
  GeoCoordinate,
  type GeoCoordinateValue,
} from '../../domain/value-objects/geo-coordinate.value-object';

type AddressResult = {
  results?: Array<{
    lat?: number;
    lon?: number;
    formatted?: string;
    place_id?: string;
  }>;
};

type RouteResult = {
  features?: Array<{
    geometry?: { coordinates?: number[][][] };
    properties?: {
      distance?: number;
      time?: number;
      polyline5?: string;
      legs?: Array<{
        steps?: Array<{
          distance?: number;
          time?: number;
          from_index?: number;
          to_index?: number;
          instruction?: { text?: string; type?: string };
        }>;
      }>;
    };
  }>;
};

@Injectable()
export class GeoapifyApiClient {
  constructor(private readonly config: ConfigService) {}

  geocodeAddress(address: string): Promise<GeocodedAddress | null> {
    return this.address('/v1/geocode/search', {
      text: address,
      filter: 'countrycode:sn',
    });
  }

  reverseGeocode(
    coordinate: GeoCoordinateValue,
  ): Promise<GeocodedAddress | null> {
    return this.address('/v1/geocode/reverse', {
      lat: String(coordinate.latitude),
      lon: String(coordinate.longitude),
    });
  }

  async autocomplete(text: string): Promise<GeocodedAddress[]> {
    const payload = await this.request<AddressResult>(
      '/v1/geocode/autocomplete',
      {
        text,
        filter: 'countrycode:sn',
        format: 'json',
        lang: 'fr',
        limit: '6',
      },
    );
    return (payload.results ?? []).flatMap((result) => {
      const coordinate = {
        latitude: result.lat ?? NaN,
        longitude: result.lon ?? NaN,
      };
      if (!GeoCoordinate.isValid(coordinate) || !result.formatted) return [];
      return [
        {
          ...coordinate,
          formattedAddress: result.formatted,
          placeId: result.place_id ?? null,
        },
      ];
    });
  }

  async computeRoutes(input: {
    origin: GeoCoordinateValue;
    destination: GeoCoordinateValue;
    alternatives: boolean;
  }): Promise<MapRoute[]> {
    const primary = await this.requestRoutes(input, 'balanced', 8_000);
    if (!input.alternatives || primary.length === 0) return primary;

    // Geoapify has no computeAlternativeRoutes switch. Its documented route
    // optimization modes can produce distinct, usable alternatives.
    const alternatives = await Promise.allSettled([
      this.requestRoutes(input, 'short', 2_000),
      this.requestRoutes(input, 'less_maneuvers', 2_000),
    ]);
    const unique = new Map<string, MapRoute>();
    for (const route of [
      ...primary,
      ...alternatives.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      ),
    ]) {
      const key = route.coordinates
        .map(({ latitude, longitude }) => `${latitude.toFixed(5)},${longitude.toFixed(5)}`)
        .join('|');
      if (!unique.has(key)) unique.set(key, { ...route, id: `route-${unique.size}` });
    }
    return [...unique.values()];
  }

  private async requestRoutes(
    input: { origin: GeoCoordinateValue; destination: GeoCoordinateValue },
    optimization: 'balanced' | 'short' | 'less_maneuvers',
    timeoutMs: number,
  ): Promise<MapRoute[]> {
    const { origin, destination } = input;
    const payload = await this.request<RouteResult>('/v1/routing', {
      waypoints: `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,
      mode: 'drive',
      type: optimization,
      lang: 'fr',
      traffic: 'approximated',
      details: 'polyline5,instruction_details',
    }, timeoutMs);
    return (payload.features ?? []).flatMap((feature, routeIndex) => {
      const properties = feature.properties;
      const coordinates = (feature.geometry?.coordinates ?? [])
        .flatMap((line) => line)
        .map(([longitude, latitude]) => ({ latitude, longitude }))
        .filter((coordinate) => GeoCoordinate.isValid(coordinate));
      if (
        !properties ||
        coordinates.length < 2 ||
        !Number.isFinite(properties.distance) ||
        !Number.isFinite(properties.time)
      )
        return [];
      const steps = (properties.legs ?? []).flatMap((leg, legIndex) =>
        (leg.steps ?? []).flatMap((step, stepIndex) => {
          const instruction = step.instruction?.text?.trim();
          if (!instruction) return [];
          return [
            {
              id: `route-${routeIndex}-leg-${legIndex}-step-${stepIndex}`,
              instruction,
              maneuver: step.instruction?.type ?? null,
              distanceMeters: Number.isFinite(step.distance)
                ? step.distance!
                : null,
              durationSeconds: Number.isFinite(step.time) ? step.time! : null,
              start: coordinates[step.from_index ?? -1] ?? null,
              end: coordinates[step.to_index ?? -1] ?? null,
            },
          ];
        }),
      );
      return [
        {
          id: `route-${routeIndex}`,
          distanceMeters: properties.distance!,
          durationSeconds: properties.time!,
          encodedPolyline: properties.polyline5 ?? '',
          coordinates,
          navigationSteps: steps,
        },
      ];
    });
  }

  private async address(
    path: string,
    query: Record<string, string>,
  ): Promise<GeocodedAddress | null> {
    const payload = await this.request<AddressResult>(path, {
      ...query,
      format: 'json',
      lang: 'fr',
      limit: '1',
    });
    const result = payload.results?.[0];
    const coordinate = {
      latitude: result?.lat ?? NaN,
      longitude: result?.lon ?? NaN,
    };
    if (!GeoCoordinate.isValid(coordinate)) return null;
    return {
      ...coordinate,
      formattedAddress:
        result?.formatted?.trim() ||
        `${coordinate.latitude}, ${coordinate.longitude}`,
      placeId: result?.place_id ?? null,
    };
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
    timeoutMs = 10_000,
  ): Promise<T> {
    const apiKey = this.config.get<string>('GEOAPIFY_API_KEY')?.trim();
    if (!apiKey) throw appHttpException('MAPS_API_KEY_MISSING');
    const params = new URLSearchParams({ ...query, apiKey });
    try {
      const response = await fetch(
        `https://api.geoapify.com${path}?${params}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok) throw new Error(`Geoapify ${response.status}`);
      return (await response.json()) as T;
    } catch {
      throw appHttpException('MAPS_GEOAPIFY_UNAVAILABLE');
    }
  }
}
