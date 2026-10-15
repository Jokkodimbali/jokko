import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { Check, CornerDownLeft, Globe, LoaderCircle, Map, MapPin, Maximize2, Minimize2, Search, LucideAngularModule } from 'lucide-angular';
import { EMPTY } from 'rxjs';
import { GoogleMapsLoaderService } from '../../../../../shared/maps/google-maps-loader.service';
import { MapProviderService } from '../../../../../shared/maps/map-provider.service';
import { MapsApiService } from '../../../../../shared/maps/maps-api.service';
import { ServiceProposalInteractiveMapComponent } from './service-proposal-interactive-map.component';

describe('ServiceProposalInteractiveMapComponent', () => {
  it('initializes the Geoapify map without loading Google', async () => {
    const googleLoad = vi.fn();
    TestBed.configureTestingModule({
      imports: [ServiceProposalInteractiveMapComponent],
      providers: [
        importProvidersFrom(LucideAngularModule.pick({ Check, CornerDownLeft, Globe, LoaderCircle, Map, MapPin, Maximize2, Minimize2, Search })),
        { provide: MapProviderService, useValue: { config: async () => ({ provider: 'geoapify', geoapifyBrowserApiKey: 'test-key' }) } },
        { provide: GoogleMapsLoaderService, useValue: { load: googleLoad, authenticationFailed$: EMPTY } },
        { provide: MapsApiService, useValue: {} },
      ],
    });

    const fixture = TestBed.createComponent(ServiceProposalInteractiveMapComponent);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.leaflet-container')).not.toBeNull();
    });
    expect(googleLoad).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Carte Geoapify indisponible');
    fixture.destroy();
  });
});
