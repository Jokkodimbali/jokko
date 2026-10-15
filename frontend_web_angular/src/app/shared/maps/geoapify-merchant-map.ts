import { geoapifyTileUrl, GEOAPIFY_ATTRIBUTION } from './geoapify-tiles';
import type * as Leaflet from 'leaflet';
import { MapProviderService } from './map-provider.service';
import { loadLeaflet } from './leaflet-loader';

export async function renderGeoapifyMerchantMap<T extends { id: string; latitude: number; longitude: number; name: string }>(
  element: HTMLElement,
  position: { latitude: number; longitude: number },
  items: T[],
  provider: MapProviderService,
  createMarker: (item: T) => HTMLButtonElement,
  select: (item: T) => void,
): Promise<Leaflet.Map> {
  const [config, leaflet] = await Promise.all([provider.config(), loadLeaflet()]);
  if (!config.geoapifyBrowserApiKey) throw new Error('Cle navigateur Geoapify manquante.');
  const map = leaflet.map(element).setView([position.latitude, position.longitude], 13);
  leaflet.tileLayer(geoapifyTileUrl(config.geoapifyBrowserApiKey), {
    maxZoom: 19,
    attribution: GEOAPIFY_ATTRIBUTION,
  }).addTo(map);
  for (const item of items) {
    const content = createMarker(item);
    content.addEventListener('click', (event) => {
      event.stopPropagation();
      select(item);
    });
    leaflet.marker([item.latitude, item.longitude], {
      title: item.name,
      icon: leaflet.divIcon({ html: content, className: 'jokko-merchant-leaflet-marker', iconSize: [42, 52], iconAnchor: [21, 52] }),
    }).addTo(map);
  }
  setTimeout(() => map.invalidateSize(), 0);
  return map;
}
