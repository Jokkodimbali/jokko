import { documentImageSize, removeEdgeBackground, validateDocumentImage } from './document-image-processing';

describe('document image processing', () => {
  it('uses document-sized assets for invoice and prescription images', () => {
    expect(documentImageSize('logo')).toEqual({ width: 512, height: 512 });
    expect(documentImageSize('signature')).toEqual({ width: 800, height: 500 });
    expect(documentImageSize('stamp')).toEqual({ width: 800, height: 500 });
  });

  it('rejects unsuitable uploads before decoding', () => {
    expect(() => validateDocumentImage(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toThrow();
    expect(() => validateDocumentImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'x.png', { type: 'image/png' }))).toThrow();
  });

  it('removes a tinted edge-connected background without deleting enclosed light details', () => {
    const width = 5;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index++) {
      const foreground = index >= 6 && index <= 8 || index >= 11 && index <= 13 || index >= 16 && index <= 18;
      const color = foreground ? (index === 12 ? 244 : 25) : 232;
      data.set([color, color, color, 255], index * 4);
    }
    const context = {
      getImageData: () => ({ data }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    removeEdgeBackground(context, width, height);
    expect(data[3]).toBe(0);
    expect(data[(width * height - 1) * 4 + 3]).toBe(0);
    expect(data[12 * 4 + 3]).toBe(255);
    expect(context.putImageData).toHaveBeenCalled();
  });
});
