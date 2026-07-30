import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const STATIONARY_SPEED_KMH = 3;
const MIN_MOVEMENT_METERS = 4;
const MAX_ACCEPTED_ACCURACY_METERS = 100;
const MAX_PLAUSIBLE_VEHICLE_SPEED_KMH = 220;

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
  async requestOrientationPermission(): Promise<void> {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return;
    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>;
    };
    if (typeof orientationEvent.requestPermission !== 'function') return;

    try {
      await orientationEvent.requestPermission(true);
    } catch {
      // GPS course remains available when the device denies compass access.
    }
  }

  watch(intervalMilliseconds = 1000): Observable<ProviderGpsPosition> {
    return new Observable((subscriber) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        subscriber.error(new Error('GEOLOCATION_UNAVAILABLE'));
        return undefined;
      }

      let lastEmissionAt = 0;
      let filteredPosition: ProviderGpsPosition | null = null;
      let stableHeading: number | null = null;
      let compassHeading: number | null = null;
      const handleOrientation = (event: DeviceOrientationEvent): void => {
        const eventWithCompass = event as DeviceOrientationEvent & {
          webkitCompassHeading?: number;
        };
        const screenAngle = this.screenOrientationAngle();
        const isAbsoluteOrientation =
          event.absolute || event.type === 'deviceorientationabsolute';
        const measuredHeading =
          typeof eventWithCompass.webkitCompassHeading === 'number' &&
          Number.isFinite(eventWithCompass.webkitCompassHeading)
            ? eventWithCompass.webkitCompassHeading + screenAngle
            : isAbsoluteOrientation && typeof event.alpha === 'number' && Number.isFinite(event.alpha)
              ? 360 - event.alpha + screenAngle
              : null;
        if (measuredHeading === null) return;
        const normalized = this.normalizeHeading(measuredHeading);
        if (compassHeading === null) {
          compassHeading = normalized;
        } else {
          const difference = Math.abs(((normalized - compassHeading + 540) % 360) - 180);
          if (difference < 2) return;
          compassHeading = this.smoothHeading(compassHeading, normalized, 0.22);
        }

        if (!filteredPosition) return;
        const now = Date.now();
        if (now - lastEmissionAt < intervalMilliseconds) return;
        const orientedPosition = this.applyCompassHeading(
          { ...filteredPosition, recordedAt: now },
          stableHeading,
          compassHeading,
        );
        filteredPosition = orientedPosition;
        stableHeading = orientedPosition.headingDegrees;
        lastEmissionAt = now;
        subscriber.next(orientedPosition);
      };
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const now = Date.now();
          if (now - lastEmissionAt < intervalMilliseconds) return;
          lastEmissionAt = now;
          const recordedAt = Number.isFinite(position.timestamp) && position.timestamp > 0
            ? position.timestamp
            : now;
          const rawPosition: ProviderGpsPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Number.isFinite(position.coords.accuracy)
              ? Math.max(1, position.coords.accuracy)
              : MAX_ACCEPTED_ACCURACY_METERS,
            headingDegrees:
              typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading)
                ? position.coords.heading
                : null,
            speedKmh:
              typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
                ? Math.max(0, position.coords.speed * 3.6)
                : null,
            recordedAt,
          };
          const nextPosition = this.filterPosition(rawPosition, filteredPosition, stableHeading);
          const orientedPosition = this.applyCompassHeading(
            nextPosition,
            stableHeading,
            compassHeading,
          );
          filteredPosition = orientedPosition;
          stableHeading = orientedPosition.headingDegrees;
          subscriber.next(orientedPosition);
        },
        (error) => subscriber.error(error),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      };
    });
  }

  private applyCompassHeading(
    position: ProviderGpsPosition,
    previousHeading: number | null,
    compassHeading: number | null,
  ): ProviderGpsPosition {
    if (compassHeading === null) return position;
    const speed = position.speedKmh ?? 0;
    const compassWeight = speed >= 20 ? 0.15 : speed >= 8 ? 0.45 : 0.82;
    const gpsHeading = position.headingDegrees;
    const target =
      gpsHeading === null
        ? compassHeading
        : this.smoothHeading(gpsHeading, compassHeading, compassWeight);
    return {
      ...position,
      headingDegrees: this.smoothHeading(previousHeading, target, speed >= 8 ? 0.68 : 0.52),
    };
  }

  private filterPosition(
    raw: ProviderGpsPosition,
    previous: ProviderGpsPosition | null,
    previousHeading: number | null,
  ): ProviderGpsPosition {
    if (!previous) {
      const moving = (raw.speedKmh ?? 0) >= STATIONARY_SPEED_KMH;
      return { ...raw, headingDegrees: moving ? raw.headingDegrees : null };
    }
    if (raw.recordedAt < previous.recordedAt) return previous;

    const rawDistance = this.distanceMeters(previous, raw);
    const elapsedSeconds = Math.max(0.1, (raw.recordedAt - previous.recordedAt) / 1000);
    const inferredSpeedKmh = (rawDistance / elapsedSeconds) * 3.6;
    const effectiveSpeedKmh = raw.speedKmh ?? inferredSpeedKmh;
    const reportedSpeedKmh = raw.speedKmh ?? previous.speedKmh ?? 0;
    const accuracyAllowance = Math.max(
      25,
      raw.accuracyMeters + previous.accuracyMeters,
    );
    const plausibleDistance =
      (Math.max(reportedSpeedKmh, 15) / 3.6) * elapsedSeconds + accuracyAllowance;
    const impossibleJump =
      inferredSpeedKmh > MAX_PLAUSIBLE_VEHICLE_SPEED_KMH &&
      rawDistance > plausibleDistance;
    const stationaryRadius = Math.max(
      MIN_MOVEMENT_METERS,
      Math.min(12, raw.accuracyMeters * 0.5),
    );
    const moving = effectiveSpeedKmh >= STATIONARY_SPEED_KMH && rawDistance >= 1.2;
    const poorAccuracyJump =
      raw.accuracyMeters > MAX_ACCEPTED_ACCURACY_METERS &&
      rawDistance < raw.accuracyMeters * 1.5;

    if ((!moving && rawDistance <= stationaryRadius) || poorAccuracyJump || impossibleJump) {
      return {
        ...raw,
        latitude: previous.latitude,
        longitude: previous.longitude,
        headingDegrees: previousHeading,
        speedKmh: impossibleJump ? previous.speedKmh : 0,
      };
    }

    const alpha = this.positionSmoothingFactor(raw.accuracyMeters, effectiveSpeedKmh);
    const latitude = previous.latitude + (raw.latitude - previous.latitude) * alpha;
    const longitude = previous.longitude + (raw.longitude - previous.longitude) * alpha;
    const filteredDistance = this.distanceMeters(previous, { ...raw, latitude, longitude });
    const measuredHeading =
      moving && raw.headingDegrees !== null
        ? raw.headingDegrees
        : filteredDistance >= MIN_MOVEMENT_METERS
          ? this.bearing(previous, { ...raw, latitude, longitude })
          : previousHeading;

    return {
      ...raw,
      latitude,
      longitude,
      speedKmh: effectiveSpeedKmh,
      headingDegrees: this.smoothHeading(previousHeading, measuredHeading, moving ? 0.72 : 0.4),
    };
  }

  private positionSmoothingFactor(accuracyMeters: number, speedKmh: number | null): number {
    if ((speedKmh ?? 0) >= 60) return 0.96;
    if ((speedKmh ?? 0) >= 25) return 0.9;
    if ((speedKmh ?? 0) >= 8) return 0.78;
    if (accuracyMeters <= 10) return 0.68;
    if (accuracyMeters <= 25) return 0.52;
    return 0.38;
  }

  private smoothHeading(previous: number | null, next: number | null, factor: number): number | null {
    if (next === null) return previous;
    if (previous === null) return this.normalizeHeading(next);
    const delta = ((next - previous + 540) % 360) - 180;
    return this.normalizeHeading(previous + delta * factor);
  }

  private bearing(from: ProviderGpsPosition, to: ProviderGpsPosition): number {
    const fromLat = (from.latitude * Math.PI) / 180;
    const toLat = (to.latitude * Math.PI) / 180;
    const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
    const y = Math.sin(longitudeDelta) * Math.cos(toLat);
    const x =
      Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(longitudeDelta);
    return this.normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
  }

  private distanceMeters(from: ProviderGpsPosition, to: ProviderGpsPosition): number {
    const earthRadius = 6_371_000;
    const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
    const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
    const fromLatitude = (from.latitude * Math.PI) / 180;
    const toLatitude = (to.latitude * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private normalizeHeading(value: number): number {
    return ((value % 360) + 360) % 360;
  }

  private screenOrientationAngle(): number {
    const screenAngle = globalThis.screen?.orientation?.angle;
    if (typeof screenAngle === 'number' && Number.isFinite(screenAngle)) {
      return screenAngle;
    }
    const legacyAngle = (globalThis as typeof globalThis & { orientation?: number }).orientation;
    return typeof legacyAngle === 'number' && Number.isFinite(legacyAngle)
      ? legacyAngle
      : 0;
  }
}
