import type { GeoCoordinateValue } from '../value-objects/geo-coordinate.value-object';

export type MapRoute = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  coordinates: GeoCoordinateValue[];
  navigationSteps: MapNavigationStep[];
};

export type MapNavigationStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  start: GeoCoordinateValue | null;
  end: GeoCoordinateValue | null;
};

export type GeocodedAddress = GeoCoordinateValue & {
  formattedAddress: string;
  placeId: string | null;
};
