import type * as Leaflet from 'leaflet';

/** Leaflet's CommonJS bundle is exposed as a default export in production builds. */
export async function loadLeaflet(): Promise<typeof Leaflet> {
  const imported = await import('leaflet');
  return resolveLeafletRuntime(imported);
}

export function resolveLeafletRuntime(imported: typeof Leaflet & { default?: typeof Leaflet }): typeof Leaflet {
  const runtime = imported.default ?? imported;
  if (typeof runtime.map !== 'function' || typeof runtime.tileLayer !== 'function') {
    throw new Error('Leaflet runtime unavailable.');
  }
  return runtime;
}
