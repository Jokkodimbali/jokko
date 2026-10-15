export type MapPoint = { lat: number; lng: number };

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type GeocodedAddress = MapCoordinate & {
  formattedAddress: string;
  placeId: string | null;
};

export type MapNavigationStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  start: MapCoordinate | null;
  end: MapCoordinate | null;
};

export type MapRouteResult = {
  id: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  encodedPolyline: string;
  coordinates: MapCoordinate[];
  navigationSteps: MapNavigationStep[];
};
