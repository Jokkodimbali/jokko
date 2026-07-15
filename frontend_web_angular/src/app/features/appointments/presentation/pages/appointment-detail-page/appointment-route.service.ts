import { Injectable } from '@angular/core';
import { GoogleMapsRouteResult } from '../../../../../shared/maps/google-maps-loader.service';
import { AppointmentTrackingView } from '../../../domain/appointments.models';
import { AppointmentGeoService, AppointmentMapCoordinate } from './appointment-geo.service';

export type AppointmentRouteStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  end: AppointmentMapCoordinate | null;
};

export type AppointmentRouteOption = {
  id: string;
  coordinates: Array<[number, number]>;
  distanceKm: number | null;
  durationMinutes: number | null;
  navigationSteps: AppointmentRouteStep[];
};

export type AppointmentRouteAlternativeView = {
  id: string;
  label: string;
  distanceLabel: string;
  durationLabel: string;
  isSelected: boolean;
};

export type SerializedAppointmentMapRoute = {
  id: string;
  selected: boolean;
  coordinates: AppointmentMapCoordinate[];
};

@Injectable({ providedIn: 'root' })
export class AppointmentRouteService {
  constructor(private readonly geo: AppointmentGeoService) {}

  mapGoogleRoutes(routes: GoogleMapsRouteResult[]): AppointmentRouteOption[] {
    return routes
      .map((route, index): AppointmentRouteOption | null => {
        const coordinates = route.coordinates
          .map((coordinate) => [coordinate.latitude, coordinate.longitude] as [number, number])
          .filter(([lat, lng]) => this.geo.isCoordinateInSenegal(lat, lng));
        if (coordinates.length < 2) return null;

        return {
          id: `route-${index}`,
          coordinates,
          distanceKm:
            typeof route.distanceMeters === 'number'
              ? Math.max(0.1, route.distanceMeters / 1000)
              : null,
          durationMinutes:
            typeof route.durationSeconds === 'number'
              ? Math.max(1, Math.round(route.durationSeconds / 60))
              : null,
          navigationSteps: (route.navigationSteps ?? []).map((step) => ({
            id: step.id,
            instruction: step.instruction,
            maneuver: step.maneuver,
            distanceMeters: step.distanceMeters,
            end: step.end ? { lat: step.end.latitude, lng: step.end.longitude } : null,
          })),
        };
      })
      .filter((route): route is AppointmentRouteOption => !!route)
      .sort((left, right) => (left.durationMinutes ?? 99999) - (right.durationMinutes ?? 99999));
  }

  mapTrackingRoute(
    route: NonNullable<AppointmentTrackingView['route']>,
    coordinates: Array<[number, number]>,
  ): AppointmentRouteOption {
    return {
      id: 'route-0',
      coordinates,
      distanceKm: route.distanceRemainingMeters / 1000,
      durationMinutes: Math.max(1, Math.round(route.durationRemainingSeconds / 60)),
      navigationSteps: (route.navigationSteps ?? []).map((step) => ({
        id: step.id,
        instruction: step.instruction,
        maneuver: step.maneuver,
        distanceMeters: step.distanceMeters,
        end: step.end ? { lat: step.end.latitude, lng: step.end.longitude } : null,
      })),
    };
  }

  serializeMapRoutes(
    routes: AppointmentRouteOption[],
    selectedRouteId: string,
  ): SerializedAppointmentMapRoute[] {
    return routes
      .filter((route) => route.coordinates.length > 1)
      .map((route) => ({
        id: route.id,
        selected: route.id === selectedRouteId,
        coordinates: route.coordinates.map(([lat, lng]) => ({ lat, lng })),
      }));
  }
}
