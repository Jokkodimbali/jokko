export type DocumentImageKind = 'logo' | 'signature' | 'stamp';

const SIZES: Record<DocumentImageKind, { width: number; height: number }> = {
  logo: { width: 512, height: 512 },
  signature: { width: 800, height: 500 },
  stamp: { width: 800, height: 500 },
};

export function documentImageSize(kind: DocumentImageKind): { width: number; height: number } {
  return SIZES[kind];
}

export function validateDocumentImage(file: File): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choisissez une image PNG, JPEG ou WebP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("L'image ne doit pas dépasser 5 Mo.");
}

function canvasFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error("Impossible de préparer l'image."));
      resolve(new File([blob], `${name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }));
    }, 'image/png');
  });
}

function makeCanvas(kind: DocumentImageKind): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  const size = documentImageSize(kind);
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error("Le traitement d'image n'est pas disponible dans ce navigateur.");
  return [canvas, context];
}

export async function prepareDocumentImage(file: File, kind: DocumentImageKind, removeBackground = false): Promise<File> {
  validateDocumentImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const [canvas, context] = makeCanvas(kind);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (removeBackground) {
      const source = document.createElement('canvas');
      source.width = width;
      source.height = height;
      const sourceContext = source.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) throw new Error("Le traitement d'image n'est pas disponible dans ce navigateur.");
      sourceContext.drawImage(bitmap, 0, 0, width, height);
      removeEdgeBackground(sourceContext, width, height);
      context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2);
    } else {
      context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    }
    return await canvasFile(canvas, file.name);
  } finally {
    bitmap.close();
  }
}

// Only connected pixels similar to the paper at the corners are removed.
// This preserves white details enclosed inside a logo, signature or stamp.
export function removeEdgeBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  const samples = corners.filter(index => data[index * 4 + 3] > 220);
  if (!samples.length) return;
  const background = [0, 1, 2].map(channel =>
    Math.round(samples.reduce((sum, index) => sum + data[index * 4 + channel], 0) / samples.length),
  );
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const add = (index: number): void => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if (data[offset + 3] < 10) return;
    const difference = Math.max(
      Math.abs(data[offset] - background[0]),
      Math.abs(data[offset + 1] - background[1]),
      Math.abs(data[offset + 2] - background[2]),
    );
    if (difference > 48) return;
    queue[tail++] = index;
    data[offset + 3] = Math.round(data[offset + 3] * Math.min(1, Math.max(0, (difference - 18) / 30)));
  };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) add(index - 1);
    if (x < width - 1) add(index + 1);
    if (index >= width) add(index - width);
    if (index < width * (height - 1)) add(index + width);
  }
  context.putImageData(image, 0, 0);
}

export async function captureDocumentImage(video: HTMLVideoElement, kind: DocumentImageKind, guide?: DOMRect): Promise<File> {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('La caméra ne fournit pas encore d’image.');
  const [canvas, context] = makeCanvas(kind);
  const ratio = canvas.width / canvas.height;
  let width = Math.min(sourceWidth, sourceHeight * ratio);
  let height = width / ratio;
  let x = (sourceWidth - width) / 2;
  let y = (sourceHeight - height) / 2;
  if (guide) {
    const bounds = video.getBoundingClientRect();
    const videoRatio = sourceWidth / sourceHeight;
    const displayedWidth = Math.min(bounds.width, bounds.height * videoRatio);
    const displayedHeight = displayedWidth / videoRatio;
    const left = bounds.left + (bounds.width - displayedWidth) / 2;
    const top = bounds.top + (bounds.height - displayedHeight) / 2;
    const guideWidth = Math.min(guide.width, guide.height * ratio);
    const guideHeight = guideWidth / ratio;
    width = Math.min(sourceWidth, guideWidth * sourceWidth / displayedWidth);
    height = Math.min(sourceHeight, guideHeight * sourceHeight / displayedHeight);
    x = Math.max(0, Math.min(sourceWidth - width, (guide.left + (guide.width - guideWidth) / 2 - left) * sourceWidth / displayedWidth));
    y = Math.max(0, Math.min(sourceHeight - height, (guide.top + (guide.height - guideHeight) / 2 - top) * sourceHeight / displayedHeight));
  }
  context.drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return canvasFile(canvas, `photo-${kind}.png`);
}
