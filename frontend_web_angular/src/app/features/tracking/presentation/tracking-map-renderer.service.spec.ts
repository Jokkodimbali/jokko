import { TestBed } from '@angular/core/testing';
import { MapProviderService } from '../../../shared/maps/map-provider.service';
import { TrackingGoogleMapRendererService } from './tracking-google-map-renderer.service';
import { TrackingGeoapifyMapRendererService } from './tracking-geoapify-map-renderer.service';
import { TrackingMapRendererService } from './tracking-map-renderer.service';

describe('TrackingMapRendererService', () => {
  it.each(['google', 'geoapify'] as const)('selects %s without initializing the other renderer', async (provider) => {
    const google = { initializeRouteMap: vi.fn().mockResolvedValue(undefined), supportsSatellite: true };
    const geoapify = { initializeRouteMap: vi.fn().mockResolvedValue(undefined), supportsSatellite: false };
    TestBed.configureTestingModule({ providers: [
      TrackingMapRendererService,
      { provide: MapProviderService, useValue: { config: async () => ({ provider }) } },
      { provide: TrackingGoogleMapRendererService, useValue: google },
      { provide: TrackingGeoapifyMapRendererService, useValue: geoapify },
    ] });
    const renderer = TestBed.inject(TrackingMapRendererService);
    await renderer.initializeRouteMap(document.createElement('div'), false, () => undefined);
    expect(provider === 'google' ? google.initializeRouteMap : geoapify.initializeRouteMap).toHaveBeenCalledOnce();
    expect(provider === 'google' ? geoapify.initializeRouteMap : google.initializeRouteMap).not.toHaveBeenCalled();
    expect(renderer.supportsSatellite()).toBe(provider === 'google');
    TestBed.resetTestingModule();
  });
});
