import type { MapPoint } from '../../../shared/maps/map.models';
import type { NavigationCameraMode, TrackingMapRenderState } from './tracking-map.models';

export interface TrackingMapRendererPort {
  readonly supportsSatellite: boolean;
  initializeRouteMap(
    element: HTMLElement,
    satellite: boolean,
    onRouteSelected: (id: string) => void,
    initialCenter?: MapPoint,
  ): Promise<void>;
  render(state: TrackingMapRenderState): void;
  setSatellite(enabled: boolean): void;
  setTopView(enabled: boolean): void;
  setHeading(degrees: number): void;
  recenterNavigationCamera(): void;
  getCameraMode(): NavigationCameraMode;
  resetTravelerMarker(): void;
  resetRoute(): void;
  destroyRouteMap(): void;
  destroy(): void;
}
