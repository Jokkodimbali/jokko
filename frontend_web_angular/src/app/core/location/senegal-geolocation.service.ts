import { Injectable } from '@angular/core';

export type SenegalGeolocationResult = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedKmh: number | null;
};

export type SenegalGeolocationOptions = {
  enableHighAccuracy?: boolean;
  maximumAgeMs?: number;
  desiredAccuracyMeters?: number;
  accuracyWaitMs?: number;
};

const SENEGAL_BOUNDS = {
  minLatitude: 12,
  maxLatitude: 17.2,
  minLongitude: -18.7,
  maxLongitude: -11,
} as const;

@Injectable({ providedIn: 'root' })
export class SenegalGeolocationService {
  getCurrentPosition(
    timeoutMs = 30_000,
    options: SenegalGeolocationOptions = {},
  ): Promise<SenegalGeolocationResult> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.reject(new Error('Geolocation unavailable'));
    }

    return new Promise((resolve, reject) => {
      let watchId: number | null = null;
      let completed = false;
      let outsideSenegalReceived = false;
      let bestPosition: SenegalGeolocationResult | null = null;
      let accuracyTimeoutId: number | null = null;

      const cleanup = (): void => {
        window.clearTimeout(timeoutId);
        if (accuracyTimeoutId !== null) window.clearTimeout(accuracyTimeoutId);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      };
      const finish = (position: SenegalGeolocationResult): void => {
        if (completed) return;
        completed = true;
        cleanup();
        resolve(position);
      };
      const fail = (error: Error): void => {
        if (completed) return;
        completed = true;
        cleanup();
        reject(error);
      };
      const timeoutId = window.setTimeout(
        () =>
          bestPosition
            ? finish(bestPosition)
            : fail(new Error(outsideSenegalReceived ? 'Geolocation outside Senegal' : 'Geolocation timeout')),
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
          const currentPosition: SenegalGeolocationResult = {
            latitude,
            longitude,
            accuracyMeters: this.finiteOrNull(position.coords.accuracy),
            headingDegrees: this.finiteOrNull(position.coords.heading),
            speedKmh:
              typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
                ? position.coords.speed * 3.6
                : null,
          };
          const currentAccuracy = currentPosition.accuracyMeters ?? Number.POSITIVE_INFINITY;
          const bestAccuracy = bestPosition?.accuracyMeters ?? Number.POSITIVE_INFINITY;
          if (!bestPosition || currentAccuracy < bestAccuracy) bestPosition = currentPosition;
          if (!options.desiredAccuracyMeters || currentAccuracy <= options.desiredAccuracyMeters) {
            finish(currentPosition);
            return;
          }
          if (accuracyTimeoutId === null) {
            accuracyTimeoutId = window.setTimeout(
              () => bestPosition && finish(bestPosition),
              Math.min(options.accuracyWaitMs ?? 8_000, timeoutMs),
            );
          }
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
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          maximumAge: options.maximumAgeMs ?? 0,
          timeout: Math.min(timeoutMs, 15_000),
        },
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
