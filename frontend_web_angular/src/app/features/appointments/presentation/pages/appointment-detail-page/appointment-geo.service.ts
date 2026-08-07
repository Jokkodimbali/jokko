import { Injectable } from '@angular/core';

export type AppointmentMapCoordinate = { lat: number; lng: number };

const SENEGAL_GEO_BOUNDS = {
  minLat: 12.0,
  maxLat: 17.2,
  minLng: -18.7,
  maxLng: -11.0,
} as const;

@Injectable({ providedIn: 'root' })
export class AppointmentGeoService {
  routePointKey(point: [number, number]): string {
    return point.map((value) => value.toFixed(5)).join(',');
  }

  normalizeAddressQuery(value: string): string {
    return value
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractCoordinatesFromAddress(value: string): AppointmentMapCoordinate | null {
    const match = value.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
    if (!match) return null;

    const lat = Number(match[1].replace(',', '.'));
    const lng = Number(match[2].replace(',', '.'));
    if (!this.isCoordinateInSenegal(lat, lng)) return null;

    return { lat, lng };
  }

  hasCoordinateLikeAddress(value: string): boolean {
    return /-?\d{1,2}(?:[.,]\d+)?\s*[,;]\s*-?\d{1,3}(?:[.,]\d+)?/.test(value);
  }

  isCoordinateInSenegal(lat: number, lng: number): boolean {
    return (
      this.isValidCoordinatePair(lat, lng) &&
      lat >= SENEGAL_GEO_BOUNDS.minLat &&
      lat <= SENEGAL_GEO_BOUNDS.maxLat &&
      lng >= SENEGAL_GEO_BOUNDS.minLng &&
      lng <= SENEGAL_GEO_BOUNDS.maxLng
    );
  }

  distanceMetersBetweenPoints(
    origin: AppointmentMapCoordinate,
    destination: AppointmentMapCoordinate,
  ): number {
    const earthRadius = 6_371_000;
    const latitudeDelta = ((destination.lat - origin.lat) * Math.PI) / 180;
    const longitudeDelta = ((destination.lng - origin.lng) * Math.PI) / 180;
    const originLatitude = (origin.lat * Math.PI) / 180;
    const destinationLatitude = (destination.lat * Math.PI) / 180;
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private isValidCoordinatePair(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}
