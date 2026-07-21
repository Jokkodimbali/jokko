import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type ProviderGpsPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  headingDegrees: number | null;
  speedKmh: number | null;
  recordedAt: number;
};

@Injectable({ providedIn: 'root' })
export class ProviderLocationService {
  watch(intervalMilliseconds = 2000): Observable<ProviderGpsPosition> {
    return new Observable((subscriber) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        subscriber.error(new Error('GEOLOCATION_UNAVAILABLE'));
        return undefined;
      }

      let lastEmissionAt = 0;
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const now = Date.now();
          if (now - lastEmissionAt < intervalMilliseconds) return;
          lastEmissionAt = now;
          subscriber.next({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            headingDegrees:
              typeof position.coords.heading === 'number'
                ? position.coords.heading
                : null,
            speedKmh:
              typeof position.coords.speed === 'number'
                ? position.coords.speed * 3.6
                : null,
            recordedAt: now,
          });
        },
        (error) => subscriber.error(error),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );

      return () => navigator.geolocation.clearWatch(watchId);
    });
  }
}
