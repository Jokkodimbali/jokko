import { Injectable } from '@angular/core';

export type SenegalGeolocationResult = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedKmh: number | null;
};

const SENEGAL_BOUNDS = {
  minLatitude: 12,
  maxLatitude: 17.2,
  minLongitude: -18.7,
  maxLongitude: -11,
} as const;

@Injectable({ providedIn: 'root' })
export class SenegalGeolocationService {
  getCurrentPosition(timeoutMs = 30_000): Promise<SenegalGeolocationResult> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.reject(new Error('Geolocation unavailable'));
    }

    return new Promise((resolve, reject) => {
      let watchId: number | null = null;
      let completed = false;
      let outsideSenegalReceived = false;

      const cleanup = (): void => {
        window.clearTimeout(timeoutId);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      };
      const fail = (error: Error): void => {
        if (completed) return;
        completed = true;
        cleanup();
        reject(error);
      };
      const timeoutId = window.setTimeout(
        () =>
          fail(
            new Error(
              outsideSenegalReceived ? 'Geolocation outside Senegal' : 'Geolocation timeout',
            ),
          ),
        timeoutMs,
      );

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (!this.isInSenegal(latitude, longitude)) {
            outsideSenegalReceived = true;
            return;
          }
          if (completed) return;
          completed = true;
          cleanup();
          resolve({
            latitude,
            longitude,
            accuracyMeters: this.finiteOrNull(position.coords.accuracy),
            headingDegrees: this.finiteOrNull(position.coords.heading),
            speedKmh:
              typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
                ? position.coords.speed * 3.6
                : null,
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            fail(new Error('Geolocation permission denied'));
            return;
          }
          // Un TIMEOUT natif peut concerner une seule mesure du watcher.
          // Le délai global ci-dessus laisse au GPS le temps de fournir la suivante.
          if (error.code !== error.TIMEOUT) fail(new Error('Geolocation unavailable'));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: Math.min(timeoutMs, 15_000) },
      );
    });
  }

  isInSenegal(latitude: number, longitude: number): boolean {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= SENEGAL_BOUNDS.minLatitude &&
      latitude <= SENEGAL_BOUNDS.maxLatitude &&
      longitude >= SENEGAL_BOUNDS.minLongitude &&
      longitude <= SENEGAL_BOUNDS.maxLongitude
    );
  }

  private finiteOrNull(value: number | null): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
