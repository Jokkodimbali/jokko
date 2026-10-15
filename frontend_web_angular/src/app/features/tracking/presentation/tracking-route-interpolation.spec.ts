import { interpolateTrackingPosition } from './tracking-route-interpolation';

describe('interpolateTrackingPosition', () => {
  const start = { lat: 14.7, lng: -17.5 };
  const corner = { lat: 14.7, lng: -17.499 };
  const end = { lat: 14.701, lng: -17.499 };

  it('suit le virage du trajet entre deux mesures GPS et conserve exactement les deux mesures', () => {
    const route = [start, corner, end];
    expect(interpolateTrackingPosition(start, end, 0, route)).toEqual(start);
    const midpoint = interpolateTrackingPosition(start, end, 0.5, route);
    expect(midpoint.lng).toBeCloseTo(corner.lng, 5);
    expect(midpoint.lat).toBeCloseTo(corner.lat, 4);
    expect(interpolateTrackingPosition(start, end, 1, route)).toEqual(end);
  });

  it('reste sur la position GPS si la route est eloignee ou si le trajet recule', () => {
    const route = [start, corner, end];
    const offRoad = { lat: 14.702, lng: -17.502 };
    expect(interpolateTrackingPosition(offRoad, end, 0.5, route)).toEqual({
      lat: (offRoad.lat + end.lat) / 2,
      lng: (offRoad.lng + end.lng) / 2,
    });
    expect(interpolateTrackingPosition(end, start, 0.5, route)).toEqual({
      lat: (end.lat + start.lat) / 2,
      lng: (end.lng + start.lng) / 2,
    });
  });

  it('ne depasse jamais le dernier point recu', () => {
    expect(interpolateTrackingPosition(start, end, 1.5, [start, corner, end])).toEqual(end);
  });
});
