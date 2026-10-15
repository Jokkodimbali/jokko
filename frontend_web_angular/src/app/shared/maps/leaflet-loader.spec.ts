import type * as Leaflet from 'leaflet';
import { resolveLeafletRuntime } from './leaflet-loader';

describe('resolveLeafletRuntime', () => {
  it('uses the default export produced by the production CommonJS bundle', () => {
    const leaflet = { map: vi.fn(), tileLayer: vi.fn() } as unknown as typeof Leaflet;
    expect(resolveLeafletRuntime({ default: leaflet } as typeof Leaflet & { default: typeof Leaflet })).toBe(leaflet);
  });

  it('accepts a namespace export in development', () => {
    const leaflet = { map: vi.fn(), tileLayer: vi.fn() } as unknown as typeof Leaflet;
    expect(resolveLeafletRuntime(leaflet)).toBe(leaflet);
  });
});
