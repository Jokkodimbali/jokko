import { TestBed } from '@angular/core/testing';
import {
  GoogleMapsLoaderService,
  GoogleMapsPoint,
} from '../../../shared/maps/google-maps-loader.service';
import {
  TrackingGoogleMapRendererService,
  TrackingMapRenderState,
} from './tracking-google-map-renderer.service';

type RouteMatcher = {
  snapTravelerMarkerToRoute(
    position: GoogleMapsPoint,
    state: TrackingMapRenderState,
  ): GoogleMapsPoint;
};

const routeState: TrackingMapRenderState = {
  provider: { lat: 0, lng: 0 },
  destination: { lat: 0, lng: 0.02 },
  routes: [
    {
      id: 'selected-route',
      selected: true,
      coordinates: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.02 },
      ],
    },
  ],
  destinationMarker: { title: 'Arrivee', subtitle: '', etaLabel: '2 min', accent: 'blue' },
  remainingLabel: '2 min',
  statusLabel: 'En route',
  headingDegrees: 90,
  arrived: false,
  travelerMarker: {
    kind: 'navigation',
    imageUrl: null,
    initials: 'J',
    name: 'Jokko',
    roleLabel: 'En route',
  },
};

describe('TrackingGoogleMapRendererService map matching', () => {
  let matcher: RouteMatcher;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackingGoogleMapRendererService,
        { provide: GoogleMapsLoaderService, useValue: {} },
      ],
    });
    matcher = TestBed.inject(TrackingGoogleMapRendererService) as unknown as RouteMatcher;
  });

  it('projects a nearby navigation marker onto the selected route', () => {
    const matched = matcher.snapTravelerMarkerToRoute(
      { lat: 0.0001, lng: 0.005 },
      { ...routeState, accuracyMeters: 10 },
    );

    expect(matched.lat).toBeCloseTo(0, 7);
    expect(matched.lng).toBeCloseTo(0.005, 7);
  });

  it('keeps the GPS position when it is too far from the selected route', () => {
    const position = { lat: 0.001, lng: 0.005 };
    const matched = matcher.snapTravelerMarkerToRoute(position, {
      ...routeState,
      accuracyMeters: 10,
    });

    expect(matched).toEqual(position);
  });
});
