import { TestBed } from '@angular/core/testing';
import {
  GoogleMapsLoaderService,
  GoogleMapsPoint,
} from '../../../shared/maps/google-maps-loader.service';
import {
  TrackingGoogleMapRendererService,
  TrackingMapRenderState,
} from './tracking-google-map-renderer.service';

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

describe('TrackingGoogleMapRendererService marker position', () => {
  let renderer: TrackingGoogleMapRendererService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackingGoogleMapRendererService,
        { provide: GoogleMapsLoaderService, useValue: {} },
      ],
    });
    renderer = TestBed.inject(TrackingGoogleMapRendererService);
  });

  it('renders the raw GPS position instead of projecting it onto the selected route', () => {
    const position = { lat: 0.001, lng: 0.005 };
    const internals = renderer as unknown as Record<string, unknown>;
    internals['google'] = {};
    internals['routeMap'] = {};
    internals['upsertDestinationMarker'] = () => undefined;
    internals['routesStartingAtProvider'] = () => [];
    internals['renderRoutes'] = () => undefined;
    internals['fitRoute'] = () => undefined;
    internals['refreshRenderedTravelerMarker'] = () => undefined;
    let renderedPosition: GoogleMapsPoint | null = null;
    internals['upsertProviderMarker'] = (
      _marker: unknown,
      _map: unknown,
      provider: GoogleMapsPoint,
    ) => {
      renderedPosition = provider;
      return undefined;
    };

    renderer.render({
      ...routeState,
      provider: position,
      accuracyMeters: 10,
    });

    expect(renderedPosition).toEqual(position);
  });

  it('keeps the destination pointer as the bottom-most element when a person is shown', () => {
    const internals = renderer as unknown as {
      destinationMarkerContent: (marker: TrackingMapRenderState['destinationMarker']) => HTMLElement;
    };
    const content = internals.destinationMarkerContent({
      ...routeState.destinationMarker,
      person: {
        imageUrl: null,
        initials: 'MN',
        name: 'Prestataire',
        label: 'Prestataire',
        badgeAccent: 'red',
      },
    });

    expect(content.children).toHaveLength(3);
    expect(content.lastElementChild?.className).toBe('jokko-tracking-arrival-pointer');
  });

  it('renders the main route and clickable alternatives with distinct Google Maps-like styles', () => {
    const created: FakePolyline[] = [];
    class FakePolyline {
      options: Record<string, unknown>;
      listeners = new Map<string, () => void>();

      constructor(options: Record<string, unknown>) {
        this.options = options;
        created.push(this);
      }

      setMap(): void {}
      setPath(): void {}
      setOptions(options: Record<string, unknown>): void {
        this.options = options;
      }
      addListener(eventName: string, handler: () => void): void {
        this.listeners.set(eventName, handler);
      }
    }
    const selectedRoutes: string[] = [];
    const internals = renderer as unknown as Record<string, unknown>;
    internals['google'] = {
      maps: {
        Polyline: FakePolyline,
        event: { clearInstanceListeners: () => undefined },
      },
    };
    internals['routeMap'] = {};
    internals['routeSelected'] = (routeId: string) => selectedRoutes.push(routeId);

    (
      internals['renderRoutes'] as (routes: TrackingMapRenderState['routes']) => void
    )([
      ...routeState.routes,
      {
        id: 'alternative-route',
        selected: false,
        coordinates: [
          { lat: 0.001, lng: 0 },
          { lat: 0.001, lng: 0.02 },
        ],
      },
    ]);

    expect(created).toHaveLength(2);
    expect(created[0]?.options['strokeColor']).toBe('#1eb980');
    expect(created[0]?.options['zIndex']).toBe(20);
    expect(created[1]?.options['strokeColor']).toBe('#64748b');
    expect(created[1]?.options['zIndex']).toBe(10);
    expect(created[1]?.options['clickable']).toBe(true);

    created[1]?.listeners.get('click')?.();
    expect(selectedRoutes).toEqual(['alternative-route']);
  });

  it('prioritizes reliable GPS heading over a nearby route direction while moving', () => {
    const internals = renderer as unknown as Record<string, unknown>;
    internals['lastProviderPosition'] = { lat: -0.0001, lng: 0.005 };
    internals['currentTravelerHeading'] = 0;

    const heading = (
      internals['resolveHeading'] as (
        position: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => number
    )(
      { lat: 0, lng: 0.005 },
      { ...routeState, headingDegrees: 0, speedKmh: 50 },
    );

    expect(heading).toBeCloseTo(0, 5);
  });
});

type FakePolyline = {
  options: Record<string, unknown>;
  listeners: Map<string, () => void>;
};
