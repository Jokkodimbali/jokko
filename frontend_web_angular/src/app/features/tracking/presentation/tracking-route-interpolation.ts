import type { MapPoint } from '../../../shared/maps/map.models';

const EARTH_METERS_PER_DEGREE = 111_320;
const MAX_ROUTE_SNAP_METERS = 35;

function distanceMeters(a: MapPoint, b: MapPoint): number {
  const latitudeScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(
    (a.lat - b.lat) * EARTH_METERS_PER_DEGREE,
    (a.lng - b.lng) * EARTH_METERS_PER_DEGREE * latitudeScale,
  );
}

function mix(a: MapPoint, b: MapPoint, fraction: number): MapPoint {
  return { lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction };
}

function project(point: MapPoint, route: MapPoint[]): { progress: number; distance: number } | null {
  if (route.length < 2) return null;
  let best: { progress: number; distance: number } | null = null;
  let covered = 0;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const segmentLength = distanceMeters(start, end);
    if (segmentLength < 0.01) continue;
    const latitudeScale = Math.cos(point.lat * Math.PI / 180);
    const east = (end.lng - start.lng) * latitudeScale;
    const north = end.lat - start.lat;
    const fraction = Math.max(0, Math.min(1,
      ((point.lng - start.lng) * latitudeScale * east + (point.lat - start.lat) * north) /
      (east * east + north * north),
    ));
    const candidate = mix(start, end, fraction);
    const distance = distanceMeters(point, candidate);
    if (!best || distance < best.distance) best = { progress: covered + segmentLength * fraction, distance };
    covered += segmentLength;
  }
  return best;
}

function alongRoute(route: MapPoint[], progress: number): MapPoint {
  let covered = 0;
  for (let index = 1; index < route.length; index += 1) {
    const length = distanceMeters(route[index - 1], route[index]);
    if (covered + length >= progress && length > 0) {
      return mix(route[index - 1], route[index], (progress - covered) / length);
    }
    covered += length;
  }
  return route.at(-1)!;
}

/** Interpolates only between confirmed GPS samples; never predicts beyond the latest sample. */
export function interpolateTrackingPosition(
  from: MapPoint,
  to: MapPoint,
  fraction: number,
  selectedRoute: MapPoint[] | null,
): MapPoint {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped === 0) return from;
  if (clamped === 1) return to;
  if (selectedRoute && selectedRoute.length > 1) {
    const start = project(from, selectedRoute);
    const end = project(to, selectedRoute);
    const directDistance = distanceMeters(from, to);
    if (
      start && end && start.distance <= MAX_ROUTE_SNAP_METERS &&
      end.distance <= MAX_ROUTE_SNAP_METERS && end.progress > start.progress &&
      end.progress - start.progress <= directDistance * 1.8 + 40
    ) {
      const roadPoint = alongRoute(selectedRoute, start.progress + (end.progress - start.progress) * clamped);
      // Join the actual GPS endpoints smoothly without shifting the confirmed samples.
      const edgeBlend = Math.min(1, clamped * 5, (1 - clamped) * 5);
      return mix(mix(from, to, clamped), roadPoint, edgeBlend);
    }
  }
  return mix(from, to, clamped);
}
