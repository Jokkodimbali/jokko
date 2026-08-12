import { GoogleMapsPoint } from '../../../shared/maps/google-maps-loader.service';

export const NAVIGATION_CAMERA_CONFIG = {
  zoom: { near: 19.8, far: 18.15, speedCapKmh: 130, maneuverBoost: 0.42 },
  tilt: { low: 67, high: 60, speedCapKmh: 100, maneuverReduction: 5 },
  lookAhead: { minMeters: 14, maxMeters: 180, speedCapKmh: 130, routeWeight: 0.56 },
  accuracy: { excellentMeters: 10, goodMeters: 25, degradedMeters: 50, poorMeters: 100 },
  speedSmoothing: 0.28,
  maneuver: { nearMeters: 35, approachMeters: 180 },
  curvature: { fullAnticipationDegrees: 75, maxHeadingWeight: 0.82 },
} as const;

export type NavigationCameraInput = {
  position: GoogleMapsPoint;
  headingDegrees: number;
  speedKmh: number | null | undefined;
  accuracyMeters: number | null | undefined;
  routeTarget: GoogleMapsPoint | null;
  routeBearingDegrees?: number | null;
  futureRouteBearingDegrees?: number | null;
  routeConfidence?: number | null;
  nextManeuverDistanceMeters?: number | null;
};

export type NavigationCameraDecision = {
  target: GoogleMapsPoint;
  zoom: number;
  tilt: number;
  lookAheadMeters: number;
  headingDegrees: number;
  confidence: 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR' | 'UNRELIABLE';
};

export class NavigationCameraEngine {
  private smoothedSpeedKmh: number | null = null;

  decide(input: NavigationCameraInput): NavigationCameraDecision {
    const speed = this.smoothSpeed(input.speedKmh);
    const confidence = this.locationConfidence(input.accuracyMeters);
    const confidenceFactor =
      confidence === 'UNRELIABLE'
        ? 0.3
        : confidence === 'POOR'
          ? 0.55
          : confidence === 'DEGRADED'
            ? 0.78
            : 1;
    const speedProgress = smoothstep(
      clamp(speed / NAVIGATION_CAMERA_CONFIG.lookAhead.speedCapKmh, 0, 1),
    );
    const lookAheadMeters =
      (NAVIGATION_CAMERA_CONFIG.lookAhead.minMeters +
        (NAVIGATION_CAMERA_CONFIG.lookAhead.maxMeters - NAVIGATION_CAMERA_CONFIG.lookAhead.minMeters) * speedProgress) *
      confidenceFactor;
    const maneuverProgress = maneuverProximity(input.nextManeuverDistanceMeters);
    const headingDegrees = this.cameraHeading(input, speed, confidence);
    const target = this.targetFor(
      input.position,
      input.headingDegrees,
      lookAheadMeters,
      maneuverProgress,
      input.routeTarget,
    );
    const zoomBase = lerp(
      NAVIGATION_CAMERA_CONFIG.zoom.near,
      NAVIGATION_CAMERA_CONFIG.zoom.far,
      smoothstep(clamp(speed / NAVIGATION_CAMERA_CONFIG.zoom.speedCapKmh, 0, 1)),
    );
    const tiltBase = lerp(
      NAVIGATION_CAMERA_CONFIG.tilt.low,
      NAVIGATION_CAMERA_CONFIG.tilt.high,
      smoothstep(clamp(speed / NAVIGATION_CAMERA_CONFIG.tilt.speedCapKmh, 0, 1)),
    );
    return {
      target,
      headingDegrees,
      zoom: zoomBase + maneuverProgress * NAVIGATION_CAMERA_CONFIG.zoom.maneuverBoost,
      tilt: tiltBase - maneuverProgress * NAVIGATION_CAMERA_CONFIG.tilt.maneuverReduction,
      lookAheadMeters,
      confidence,
    };
  }

  applyRouteTarget(
    input: NavigationCameraInput,
    decision: NavigationCameraDecision,
    routeTarget: GoogleMapsPoint | null,
  ): NavigationCameraDecision {
    const maneuverProgress = maneuverProximity(input.nextManeuverDistanceMeters);
    return {
      ...decision,
      target: this.targetFor(
        input.position,
        input.headingDegrees,
        decision.lookAheadMeters,
        maneuverProgress,
        routeTarget,
      ),
    };
  }

  reset(): void {
    this.smoothedSpeedKmh = null;
  }

  private cameraHeading(
    input: NavigationCameraInput,
    speedKmh: number,
    confidence: NavigationCameraDecision['confidence'],
  ): number {
    const routeBearing = validHeading(input.routeBearingDegrees);
    const futureBearing = validHeading(input.futureRouteBearingDegrees);
    if (routeBearing === null || confidence === 'UNRELIABLE') {
      return normalizeHeading(input.headingDegrees);
    }
    const routeConfidence = clamp(input.routeConfidence ?? 1, 0, 1);
    const lowSpeedFactor = clamp(speedKmh / 20, 0, 1);
    const routeWeight = (0.55 + lowSpeedFactor * 0.35) * routeConfidence;
    let anticipatedRouteBearing = routeBearing;
    if (futureBearing !== null) {
      const turnDelta = shortestAngleDelta(routeBearing, futureBearing);
      const curvatureProgress = smoothstep(
        clamp(
          Math.abs(turnDelta) / NAVIGATION_CAMERA_CONFIG.curvature.fullAnticipationDegrees,
          0,
          1,
        ),
      );
      const anticipationWeight =
        curvatureProgress * NAVIGATION_CAMERA_CONFIG.curvature.maxHeadingWeight;
      anticipatedRouteBearing = normalizeHeading(routeBearing + turnDelta * anticipationWeight);
    }
    return normalizeHeading(
      input.headingDegrees +
        shortestAngleDelta(input.headingDegrees, anticipatedRouteBearing) * routeWeight,
    );
  }

  private smoothSpeed(speedKmh: number | null | undefined): number {
    const next =
      typeof speedKmh === 'number' && Number.isFinite(speedKmh)
        ? Math.max(0, speedKmh)
        : this.smoothedSpeedKmh ?? 0;
    this.smoothedSpeedKmh =
      this.smoothedSpeedKmh === null
        ? next
        : lerp(this.smoothedSpeedKmh, next, NAVIGATION_CAMERA_CONFIG.speedSmoothing);
    return this.smoothedSpeedKmh;
  }

  private locationConfidence(accuracyMeters: number | null | undefined): NavigationCameraDecision['confidence'] {
    const accuracy =
      typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)
        ? accuracyMeters
        : NAVIGATION_CAMERA_CONFIG.accuracy.degradedMeters;
    if (accuracy <= NAVIGATION_CAMERA_CONFIG.accuracy.excellentMeters) return 'EXCELLENT';
    if (accuracy <= NAVIGATION_CAMERA_CONFIG.accuracy.goodMeters) return 'GOOD';
    if (accuracy <= NAVIGATION_CAMERA_CONFIG.accuracy.degradedMeters) return 'DEGRADED';
    if (accuracy <= NAVIGATION_CAMERA_CONFIG.accuracy.poorMeters) return 'POOR';
    return 'UNRELIABLE';
  }

  private targetFor(
    position: GoogleMapsPoint,
    headingDegrees: number,
    lookAheadMeters: number,
    maneuverProgress: number,
    routeTarget: GoogleMapsPoint | null,
  ): GoogleMapsPoint {
    const targetPoint = routeTarget ?? pointAtBearing(position, headingDegrees, lookAheadMeters);
    const routeWeight =
      NAVIGATION_CAMERA_CONFIG.lookAhead.routeWeight + maneuverProgress * 0.18;
    return {
      lat: position.lat + (targetPoint.lat - position.lat) * routeWeight,
      lng: position.lng + (targetPoint.lng - position.lng) * routeWeight,
    };
  }
}

function validHeading(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? normalizeHeading(value) : null;
}

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function shortestAngleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function maneuverProximity(distanceMeters: number | null | undefined): number {
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters)) return 0;
  const { nearMeters, approachMeters } = NAVIGATION_CAMERA_CONFIG.maneuver;
  return 1 - smoothstep(clamp((distanceMeters - nearMeters) / (approachMeters - nearMeters), 0, 1));
}

function pointAtBearing(point: GoogleMapsPoint, headingDegrees: number, distanceMeters: number): GoogleMapsPoint {
  const earthRadius = 6_371_000;
  const bearing = (headingDegrees * Math.PI) / 180;
  const latitude = (point.lat * Math.PI) / 180;
  const longitude = (point.lng * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadius;
  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const nextLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude),
  );
  return { lat: (nextLatitude * 180) / Math.PI, lng: (nextLongitude * 180) / Math.PI };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
