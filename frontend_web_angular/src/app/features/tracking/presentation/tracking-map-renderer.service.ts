import { Injectable, inject } from '@angular/core';
import { MapProviderService } from '../../../shared/maps/map-provider.service';
import type { MapPoint } from '../../../shared/maps/map.models';
import { TrackingGoogleMapRendererService } from './tracking-google-map-renderer.service';
import type { NavigationCameraMode, TrackingMapRenderState } from './tracking-map.models';
import { TrackingGeoapifyMapRendererService } from './tracking-geoapify-map-renderer.service';
import type { TrackingMapRendererPort } from './tracking-map-renderer.port';

@Injectable()
export class TrackingMapRendererService {
  private readonly provider = inject(MapProviderService);
  private readonly google = inject(TrackingGoogleMapRendererService);
  private readonly geoapify = inject(TrackingGeoapifyMapRendererService);
  private active: TrackingMapRendererPort | null = null;

  async initializeRouteMap(
    element: HTMLElement,
    satellite: boolean,
    onRouteSelected: (id: string) => void,
    initialCenter?: MapPoint,
  ): Promise<void> {
    const config = await this.provider.config();
    this.active = config.provider === 'geoapify' ? this.geoapify : this.google;
    await this.active.initializeRouteMap(element, satellite, onRouteSelected, initialCenter);
  }
  render(state: TrackingMapRenderState): void {
    this.active?.render(state);
  }
  supportsSatellite(): boolean {
    return this.active?.supportsSatellite ?? false;
  }
  setSatellite(enabled: boolean): void {
    this.active?.setSatellite(enabled);
  }
  setTopView(enabled: boolean): void {
    this.active?.setTopView(enabled);
  }
  setHeading(degrees: number): void {
    this.active?.setHeading(degrees);
  }
  recenterNavigationCamera(): void {
    this.active?.recenterNavigationCamera();
  }
  getCameraMode(): NavigationCameraMode {
    return this.active?.getCameraMode() ?? 'FOLLOWING';
  }
  resetTravelerMarker(): void {
    this.active?.resetTravelerMarker();
  }
  resetRoute(): void {
    this.active?.resetRoute();
  }
  destroyRouteMap(): void {
    this.active?.destroyRouteMap();
  }
  destroy(): void {
    this.active?.destroy();
  }
}
