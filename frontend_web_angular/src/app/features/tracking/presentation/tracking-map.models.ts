import type { MapPoint } from '../../../shared/maps/map.models';

export type TrackingMapRoute = {
  id: string;
  coordinates: MapPoint[];
  selected: boolean;
  navigationSteps?: TrackingMapNavigationStep[];
};

export type TrackingMapNavigationStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  start: MapPoint | null;
  end: MapPoint | null;
};

export type TrackingTravelerMarker = {
  kind: 'avatar' | 'vehicle' | 'navigation';
  imageUrl: string | null;
  initials: string;
  name: string;
  roleLabel: string;
  badgeAccent?: 'blue' | 'red';
};

export type TrackingDestinationMarker = {
  title: string;
  subtitle: string;
  etaLabel: string;
  accent: 'blue' | 'red';
  person?: {
    imageUrl: string | null;
    initials: string;
    name: string;
    label: string;
    badgeAccent: 'blue' | 'red';
    icon?: 'pharmacy' | 'hardware';
  } | null;
};

export type TrackingMapRenderState = {
  provider: MapPoint | null;
  positionTimestampMs?: number | null;
  accuracyMeters?: number | null;
  speedKmh?: number | null;
  destination: MapPoint | null;
  routes: TrackingMapRoute[];
  showAlternativeRoutes?: boolean;
  showManeuverMarkers?: boolean;
  routeCalculating?: boolean;
  routeMatchMode?: 'MATCHED' | 'SUSPECTED_OFF_ROUTE' | 'REROUTING' | 'JOINING_ROUTE';
  destinationMarker: TrackingDestinationMarker;
  remainingLabel: string;
  statusLabel: string;
  headingDegrees: number | null;
  arrived: boolean;
  travelerMarker: TrackingTravelerMarker;
};

export type NavigationCameraMode = 'FOLLOWING' | 'FREE' | 'RECENTERING' | 'OVERVIEW' | 'ARRIVAL';
