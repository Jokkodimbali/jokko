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

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    place_id?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
    legs?: Array<{
      steps?: Array<{
        distanceMeters?: number;
        staticDuration?: string;
        startLocation?: { latLng?: GeoCoordinateValue };
        endLocation?: { latLng?: GeoCoordinateValue };
        navigationInstruction?: {
          maneuver?: string;
          instructions?: string;
        };
      }>;
    }>;
  }>;
};

@Injectable()
export class GoogleMapsApiClient {
  constructor(private readonly configService: ConfigService) {}

  async geocodeAddress(address: string): Promise<GeocodedAddress | null> {
    return this.requestGeocode({
      address: `${address}, Senegal`,
      components: 'country:SN',
    });
  }

  async reverseGeocode(
    coordinate: GeoCoordinateValue,
  ): Promise<GeocodedAddress | null> {
    return this.requestGeocode({
      latlng: `${coordinate.latitude},${coordinate.longitude}`,
      result_type: 'street_address|route|premise|establishment',
    });
  }

  async computeRoutes(input: {
    origin: GeoCoordinateValue;
    destination: GeoCoordinateValue;
    alternatives: boolean;
  }): Promise<MapRoute[]> {
    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.requireApiKey(),
          'X-Goog-FieldMask':
            'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.navigationInstruction',
        },
        body: JSON.stringify({
          origin: { location: { latLng: input.origin } },
          destination: { location: { latLng: input.destination } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: input.alternatives,
          languageCode: 'fr-FR',
          units: 'METRIC',
        }),
      },
    );

    if (!response.ok) {
      throw appHttpException('MAPS_GOOGLE_UNAVAILABLE');
    }

    const payload = (await response.json()) as GoogleRoutesResponse;
    return (payload.routes ?? [])
      .map((route, index): MapRoute | null => {
        const encodedPolyline = route.polyline?.encodedPolyline ?? '';
        const coordinates = this.decodePolyline(encodedPolyline);
        const distanceMeters = route.distanceMeters;
        const durationSeconds = this.parseDurationSeconds(route.duration);
        if (
          coordinates.length < 2 ||
          typeof distanceMeters !== 'number' ||
          durationSeconds === null
        ) {
          return null;
        }

        return {
          id: `route-${index}`,
          distanceMeters,
          durationSeconds,
          encodedPolyline,
          coordinates,
          navigationSteps: (route.legs ?? []).flatMap((leg, legIndex) =>
            (leg.steps ?? [])
              .map((step, stepIndex) => ({
                id: `route-${index}-leg-${legIndex}-step-${stepIndex}`,
                instruction:
                  step.navigationInstruction?.instructions?.trim() || '',
                maneuver: step.navigationInstruction?.maneuver?.trim() || null,
                distanceMeters:
                  typeof step.distanceMeters === 'number'
                    ? step.distanceMeters
                    : null,
                durationSeconds: this.parseDurationSeconds(step.staticDuration),
                start: this.validCoordinateOrNull(step.startLocation?.latLng),
                end: this.validCoordinateOrNull(step.endLocation?.latLng),
              }))
              .filter((step) => step.instruction.length > 0),
          ),
        };
      })
      .filter((route): route is MapRoute => route !== null);
  }

  private async requestGeocode(
    query: Record<string, string>,
  ): Promise<GeocodedAddress | null> {
    const params = new URLSearchParams({
      ...query,
      language: 'fr',
      region: 'sn',
      key: this.requireApiKey(),
    });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      throw appHttpException('MAPS_GOOGLE_UNAVAILABLE');
    }

    const payload = (await response.json()) as GoogleGeocodeResponse;
    const result = payload.results?.find((candidate) => {
      const location = candidate.geometry?.location;
      return (
        typeof location?.lat === 'number' &&
        typeof location.lng === 'number' &&
        GeoCoordinate.isValid({
          latitude: location.lat,
          longitude: location.lng,
        })
      );
    });
    const location = result?.geometry?.location;
    if (typeof location?.lat !== 'number' || typeof location.lng !== 'number') {
      return null;
    }

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result?.formatted_address ?? '',
      placeId: result?.place_id ?? null,
    };
  }

  private requireApiKey(): string {
    const apiKey = this.configService
      .get<string>('GOOGLE_MAPS_API_KEY')
      ?.trim();
    if (!apiKey) {
      throw appHttpException('MAPS_API_KEY_MISSING');
    }
    return apiKey;
  }

  private parseDurationSeconds(value: string | undefined): number | null {
    const match = value?.match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Math.round(Number(match[1])) : null;
  }

  private validCoordinateOrNull(
    coordinate: GeoCoordinateValue | undefined,
  ): GeoCoordinateValue | null {
    return coordinate && GeoCoordinate.isValid(coordinate) ? coordinate : null;
  }

  private decodePolyline(encoded: string): GeoCoordinateValue[] {
    const coordinates: GeoCoordinateValue[] = [];
    let index = 0;
    let latitudeValue = 0;
    let longitudeValue = 0;

    while (index < encoded.length) {
      const latitude = this.decodePolylineValue(encoded, index);
      latitudeValue += latitude.value;
      index = latitude.nextIndex;

      const longitude = this.decodePolylineValue(encoded, index);
      longitudeValue += longitude.value;
      index = longitude.nextIndex;

      const coordinate = {
        latitude: latitudeValue / 1e5,
        longitude: longitudeValue / 1e5,
      };
      if (GeoCoordinate.isValid(coordinate)) {
        coordinates.push(coordinate);
      }
    }

    return coordinates;
  }

  private decodePolylineValue(
    encoded: string,
    startIndex: number,
  ): { value: number; nextIndex: number } {
    let result = 0;
    let shift = 0;
    let index = startIndex;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    return {
      value: result & 1 ? ~(result >> 1) : result >> 1,
      nextIndex: index,
    };
  }
}
