import { TestBed } from '@angular/core/testing';
import { MapProviderService } from '../../../shared/maps/map-provider.service';
import { TrackingGeoapifyMapRendererService } from './tracking-geoapify-map-renderer.service';
import type { TrackingMapRenderState } from './tracking-map.models';

describe('TrackingGeoapifyMapRendererService', () => {
  it.each([
    ['pharmacy', '/pharmacy-map-marker.jpg'],
    ['hardware', '/hardware-store-map-marker.svg'],
  ] as const)('affiche le repere %s au retrait et l avatar client au depot', (icon, image) => {
    TestBed.configureTestingModule({ providers: [
      TrackingGeoapifyMapRendererService,
      { provide: MapProviderService, useValue: {} },
    ] });
    try {
      const renderer = TestBed.inject(TrackingGeoapifyMapRendererService);
      const state: TrackingMapRenderState = {
        provider: null, destination: null, routes: [],
        travelerMarker: { kind: 'vehicle', imageUrl: null, initials: 'LV', name: 'Livreur', roleLabel: 'En route' },
        destinationMarker: {
          title: 'Retrait', subtitle: '', etaLabel: '5 min', accent: 'blue',
          person: { imageUrl: null, initials: 'CO', name: 'Commerce', label: 'Commerce', badgeAccent: 'blue', icon },
        },
        remainingLabel: '5 min', statusLabel: 'En route', headingDegrees: null, arrived: false,
      };
      const pickup = renderer['destinationContent'](state);
      expect(pickup.querySelector('img')?.getAttribute('src')).toBe(image);

      state.destinationMarker.person = {
        imageUrl: '/uploads/awa.png', initials: 'AN', name: 'Awa Ndiaye',
        label: 'Moi', badgeAccent: 'blue',
      };
      const dropoff = renderer['destinationContent'](state);
      expect(dropoff.querySelector('img')?.getAttribute('src')).toBe('/uploads/awa.png');
      expect(dropoff.textContent).toContain('Moi');
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('garde le cadrage global stable et respecte la vue libre avant le recentrage', async () => {
    TestBed.configureTestingModule({ providers: [
      TrackingGeoapifyMapRendererService,
      { provide: MapProviderService, useValue: { config: async () => ({ provider: 'geoapify', geoapifyBrowserApiKey: 'test-key' }) } },
    ] });
    const renderer = TestBed.inject(TrackingGeoapifyMapRendererService);
    const element = document.createElement('div');
    element.style.cssText = 'width:400px;height:400px;';
    document.body.appendChild(element);
    try {
      await renderer.initializeRouteMap(element, false, () => undefined);
      const map = renderer['map']!;
      const fitBounds = vi.spyOn(map, 'fitBounds');
      const setView = vi.spyOn(map, 'setView');
      const state: TrackingMapRenderState = {
        provider: { lat: 14.7, lng: -17.45 },
        destination: { lat: 14.72, lng: -17.46 },
        routes: [{ id: 'route-0', selected: true, coordinates: [
          { lat: 14.7, lng: -17.45 }, { lat: 14.71, lng: -17.455 }, { lat: 14.72, lng: -17.46 },
        ] }],
        travelerMarker: { kind: 'navigation', imageUrl: null, initials: 'PR', name: 'Prestataire', roleLabel: 'En route' },
        destinationMarker: { title: 'Chez le client', subtitle: 'Dakar', etaLabel: '5 min', accent: 'blue' },
        remainingLabel: '5 min', statusLabel: 'En route', headingDegrees: null, arrived: false,
      };

      renderer.setTopView(true);
      renderer.render(state);
      expect(renderer.getCameraMode()).toBe('OVERVIEW');
      const overviewBounds = fitBounds.mock.calls[0]?.[0] as { contains(point: [number, number]): boolean };
      expect(overviewBounds.contains([14.7, -17.45])).toBe(true);
      expect(overviewBounds.contains([14.72, -17.46])).toBe(true);
      const firstFitCount = fitBounds.mock.calls.length;
      renderer.render({ ...state, provider: { lat: 14.705, lng: -17.452 } });
      expect(fitBounds).toHaveBeenCalledTimes(firstFitCount);

      renderer.setTopView(false);
      expect(renderer.getCameraMode()).toBe('FOLLOWING');
      expect(setView).toHaveBeenCalled();
      const faceCenter = setView.mock.lastCall?.[0] as [number, number];
      expect(faceCenter[0]).toBeGreaterThan(14.7);
      map.fire('dragstart');
      expect(renderer.getCameraMode()).toBe('FREE');
      const viewCount = setView.mock.calls.length;
      renderer.setTopView(false);
      renderer.render({ ...state, provider: { lat: 14.71, lng: -17.455 } });
      expect(renderer.getCameraMode()).toBe('FREE');
      expect(setView).toHaveBeenCalledTimes(viewCount);
      renderer.recenterNavigationCamera();
      expect(renderer.getCameraMode()).toBe('FOLLOWING');
      expect(setView.mock.calls.length).toBeGreaterThan(viewCount);
    } finally {
      renderer.destroy();
      element.remove();
      TestBed.resetTestingModule();
    }
  });

  it('initialise une seule carte et affiche les deux avatars et la route', async () => {
    TestBed.configureTestingModule({ providers: [
      TrackingGeoapifyMapRendererService,
      { provide: MapProviderService, useValue: { config: async () => ({ provider: 'geoapify', geoapifyBrowserApiKey: 'test-key' }) } },
    ] });
    const renderer = TestBed.inject(TrackingGeoapifyMapRendererService);
    const element = document.createElement('div');
    element.style.cssText = 'width:400px;height:400px;';
    document.body.appendChild(element);
    try {
      await Promise.all([
        renderer.initializeRouteMap(element, false, () => undefined),
        renderer.initializeRouteMap(element, false, () => undefined),
      ]);
      const state: TrackingMapRenderState = {
        provider: { lat: 14.7, lng: -17.45 },
        destination: { lat: 14.71, lng: -17.46 },
        routes: [{ id: 'route-0', selected: true, coordinates: [{ lat: 14.7, lng: -17.45 }, { lat: 14.71, lng: -17.46 }] }],
        travelerMarker: { kind: 'avatar', imageUrl: null, initials: 'PR', name: 'Prestataire', roleLabel: 'Prestataire' },
        destinationMarker: { title: 'Chez le client', subtitle: 'Dakar', etaLabel: '5 min', accent: 'blue', person: { imageUrl: null, initials: 'CL', name: 'Client', label: 'Client', badgeAccent: 'blue' } },
        remainingLabel: '5 min', statusLabel: 'En route', headingDegrees: 0, arrived: false,
      };
      renderer.render(state);
      expect(element.textContent).toContain('PR');
      expect(element.textContent).toContain('CL');
      expect(element.querySelectorAll('.leaflet-interactive').length).toBeGreaterThan(0);
      const withManeuver = { ...state, routes: [{ ...state.routes[0], navigationSteps: [
        { instruction: 'Tournez a droite', start: { lat: 14.7, lng: -17.45 } },
      ] }] } as TrackingMapRenderState;
      renderer.render(withManeuver);
      expect(renderer['maneuverMarkers']).toHaveLength(0);
      renderer.render({ ...withManeuver, showManeuverMarkers: true });
      expect(renderer['maneuverMarkers']).toHaveLength(1);
      renderer.render({ ...withManeuver, showManeuverMarkers: false });
      expect(renderer['maneuverMarkers']).toHaveLength(0);
      renderer.render({ ...state, travelerMarker: {
        kind: 'navigation', imageUrl: '/client-avatar.png', initials: 'CL', name: 'Client', roleLabel: '5 min',
      } });
      const arrow = element.querySelector<HTMLElement>('.jokko-tracking-navigation-arrow');
      expect(arrow?.querySelector('svg path')?.getAttribute('fill')).toBe('#1a73e8');
      expect(arrow?.style.transform).toMatch(/^rotate\(/);
      renderer.render({ ...state, provider: { lat: 14.705, lng: -17.45 }, routes: [{
        id: 'route-0', selected: true,
        coordinates: [{ lat: 14.7, lng: -17.45 }, { lat: 14.71, lng: -17.45 }],
      }], travelerMarker: {
        kind: 'navigation', imageUrl: null, initials: 'CL', name: 'Client', roleLabel: '5 min',
      } });
      expect(element.querySelector<HTMLElement>('.jokko-tracking-navigation-arrow')?.style.transform)
        .toBe('rotate(0deg)');
      expect(renderer['traveler']?.getLatLng().lat).toBeCloseTo(14.705);
      renderer.render({ ...state, provider: { lat: 14.7, lng: -17.445 }, routes: [{
        id: 'route-0', selected: true,
        coordinates: [{ lat: 14.7, lng: -17.45 }, { lat: 14.7, lng: -17.44 }],
      }], travelerMarker: {
        kind: 'navigation', imageUrl: null, initials: 'CL', name: 'Client', roleLabel: '5 min',
      } });
      expect(element.querySelector<HTMLElement>('.jokko-tracking-navigation-arrow')?.style.transform)
        .toBe('rotate(90deg)');
      renderer.render({ ...state, travelerMarker: {
        kind: 'navigation', imageUrl: null, initials: 'CL', name: 'Client', roleLabel: '5 min',
      }, routeCalculating: true });
      expect(element.querySelector('.jokko-tracking-navigation-dot')).not.toBeNull();
      renderer.render({ ...state, travelerMarker: {
        kind: 'navigation', imageUrl: null, initials: 'CL', name: 'Client', roleLabel: '5 min',
      }, routeCalculating: false });
      expect(element.querySelector('.jokko-tracking-navigation-arrow')).not.toBeNull();
    } finally {
      renderer.destroy();
      element.remove();
      TestBed.resetTestingModule();
    }
  });

  it('recentre la carte a l arrivee meme lorsque les deux marqueurs sont au meme point', async () => {
    TestBed.configureTestingModule({ providers: [
      TrackingGeoapifyMapRendererService,
      { provide: MapProviderService, useValue: { config: async () => ({ provider: 'geoapify', geoapifyBrowserApiKey: 'test-key' }) } },
    ] });
    const renderer = TestBed.inject(TrackingGeoapifyMapRendererService);
    const element = document.createElement('div');
    element.style.cssText = 'width:400px;height:400px;';
    document.body.appendChild(element);
    try {
      await renderer.initializeRouteMap(element, false, () => undefined);
      const map = renderer['map']!;
      const setView = vi.spyOn(map, 'setView');
      const arrival = { lat: 14.72, lng: -17.46 };
      renderer.render({
        provider: arrival, destination: arrival, routes: [],
        travelerMarker: { kind: 'navigation', imageUrl: null, initials: 'PR', name: 'Prestataire', roleLabel: 'Arrive' },
        destinationMarker: { title: 'Chez le client', subtitle: 'Dakar', etaLabel: 'Arrive', accent: 'blue' },
        remainingLabel: '0 min', statusLabel: 'Sur place', headingDegrees: null, arrived: true,
      });
      expect(setView.mock.lastCall?.[0]).toEqual([arrival.lat, arrival.lng]);
      expect(renderer['traveler']?.getLatLng().lat).toBeCloseTo(arrival.lat);
      expect(renderer.getCameraMode()).toBe('ARRIVAL');
    } finally {
      renderer.destroy();
      element.remove();
      TestBed.resetTestingModule();
    }
  });

  it('anime le voyageur sur la route sans anticiper le GPS puis arrete l animation a l arrivee', async () => {
    TestBed.configureTestingModule({ providers: [
      TrackingGeoapifyMapRendererService,
      { provide: MapProviderService, useValue: { config: async () => ({ provider: 'geoapify', geoapifyBrowserApiKey: 'test-key' }) } },
    ] });
    const renderer = TestBed.inject(TrackingGeoapifyMapRendererService);
    const element = document.createElement('div');
    element.style.cssText = 'width:400px;height:400px;';
    document.body.appendChild(element);
    try {
      await renderer.initializeRouteMap(element, false, () => undefined);
      const start = { lat: 14.7, lng: -17.5 };
      const corner = { lat: 14.7, lng: -17.499 };
      const end = { lat: 14.701, lng: -17.499 };
      const state: TrackingMapRenderState = {
        provider: start, positionTimestampMs: 1_000,
        destination: end,
        routes: [{ id: 'route-0', selected: true, coordinates: [start, corner, end] }],
        travelerMarker: { kind: 'navigation', imageUrl: null, initials: 'PR', name: 'Prestataire', roleLabel: 'En route' },
        destinationMarker: { title: 'Chez le client', subtitle: 'Dakar', etaLabel: '5 min', accent: 'blue' },
        remainingLabel: '5 min', statusLabel: 'En route', headingDegrees: null, arrived: false,
      };
      renderer.render(state);
      const callbacks = new Map<number, FrameRequestCallback>();
      let nextId = 1;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callbacks.set(nextId, callback);
        return nextId++;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
      const startedAt = performance.now();
      renderer.render({ ...state, provider: end, positionTimestampMs: 2_000 });
      expect(renderer['traveler']?.getLatLng().lat).toBeCloseTo(start.lat);
      const firstFrame = renderer['travelerFrame']!;
      callbacks.get(firstFrame)!(startedAt + 325);
      expect(renderer['traveler']?.getLatLng().lng).toBeCloseTo(corner.lng, 4);
      const lastFrame = renderer['travelerFrame']!;
      callbacks.get(lastFrame)!(startedAt + 650);
      expect(renderer['traveler']?.getLatLng().lat).toBeCloseTo(end.lat);
      renderer.render({ ...state, provider: end, positionTimestampMs: 3_000, arrived: true, routes: [] });
      expect(renderer['travelerFrame']).toBeNull();
      expect(renderer['traveler']?.getLatLng().lng).toBeCloseTo(end.lng);
      const distant = { lat: 14.71, lng: -17.49 };
      renderer.render({ ...state, provider: distant, positionTimestampMs: 4_000 });
      expect(renderer['travelerFrame']).toBeNull();
      expect(renderer['traveler']?.getLatLng().lat).toBeCloseTo(distant.lat);
      renderer.render({ ...state, provider: end, positionTimestampMs: 10_000 });
      expect(renderer['travelerFrame']).toBeNull();
      expect(renderer['traveler']?.getLatLng().lat).toBeCloseTo(end.lat);
    } finally {
      renderer.destroy();
      element.remove();
      vi.unstubAllGlobals();
      TestBed.resetTestingModule();
    }
  });
});
