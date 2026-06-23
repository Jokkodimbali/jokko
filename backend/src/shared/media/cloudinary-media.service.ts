import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { extname, parse } from 'node:path';

export type CloudinaryUploadInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
};

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  bytes: number;
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  resource_type?: string;
  bytes?: number;
  error?: {
    message?: string;
  };
};

@Injectable()
export class CloudinaryMediaService {
  private readonly logger = new Logger(CloudinaryMediaService.name);

  async upload(input: CloudinaryUploadInput): Promise<CloudinaryUploadResult> {
    const config = this.readConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = this.buildPublicId(input.originalName);
    const folder = this.normalizeFolder(input.folder);
    const signature = this.sign(
      {
        folder,
        public_id: publicId,
        timestamp,
      },
      config.apiSecret,
    );

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.originalName);
    formData.append('api_key', config.apiKey);
    formData.append('timestamp', timestamp);
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/auto/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );
    const payload = (await response.json().catch(() => null)) as CloudinaryUploadResponse | null;

    if (!response.ok || !payload?.secure_url || !payload.public_id) {
      this.logger.error(
        `Cloudinary upload failed: ${payload?.error?.message ?? response.statusText}`,
      );
      throw new Error('CLOUDINARY_UPLOAD_FAILED');
    }

    return {
      secureUrl: payload.secure_url,
      publicId: payload.public_id,
      resourceType: payload.resource_type ?? 'auto',
      bytes: payload.bytes ?? input.buffer.length,
    };
  }

  private readConfig(): CloudinaryConfig {
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
    if (cloudinaryUrl) {
      try {
        const parsed = new URL(cloudinaryUrl);
        const cloudName = parsed.hostname;
        const apiKey = decodeURIComponent(parsed.username);
        const apiSecret = decodeURIComponent(parsed.password);

        if (cloudName && apiKey && apiSecret) {
          return { cloudName, apiKey, apiSecret };
        }
      } catch {
        this.logger.error('CLOUDINARY_URL is not valid.');
      }
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('CLOUDINARY_CONFIG_MISSING');
    }

    return { cloudName, apiKey, apiSecret };
  }

  private sign(params: Record<string, string>, apiSecret: string): string {
    const serialized = Object.entries(params)
      .filter(([, value]) => value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
  }

  private normalizeFolder(folder: string): string {
    return folder
      .split('/')
      .map((part) => this.slug(part))
      .filter(Boolean)
      .join('/');
  }

  private buildPublicId(originalName: string): string {
    const name = parse(originalName).name || 'media';
    const extension = extname(originalName).toLowerCase().replace('.', '');
    const suffix = extension ? `-${extension}` : '';
    return `${this.slug(name)}${suffix}-${Date.now()}-${randomUUID()}`;
  }

  private slug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);
  }
}
