export function geoapifyTileUrl(key: string): string {
  return `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`;
}

export const GEOAPIFY_ATTRIBUTION =
  'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | ' +
  '<a href="https://openmaptiles.org/">&copy; OpenMapTiles</a> ' +
  '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a> contributors';
