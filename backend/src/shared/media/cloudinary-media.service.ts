import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

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

export type CloudinaryDownloadUrl = {
  url: string;
  fileName: string;
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

  constructor(private readonly configService: ConfigService) {}

  async upload(input: CloudinaryUploadInput): Promise<CloudinaryUploadResult> {
    const config = this.readConfig();
    this.configureSdk(config);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = this.buildPublicId(input.originalName);
    const folder = this.normalizeFolder(input.folder);
    const resourceType = this.resourceTypeFor(input.mimeType);
    const signature = this.sign(
      {
        access_mode: 'public',
        folder,
        public_id: publicId,
        timestamp,
      },
      config.apiSecret,
    );

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.originalName,
    );
    formData.append('api_key', config.apiKey);
    formData.append('timestamp', timestamp);
    formData.append('access_mode', 'public');
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );
    const payload = (await response
      .json()
      .catch(() => null)) as CloudinaryUploadResponse | null;

    if (!response.ok || !payload?.secure_url || !payload.public_id) {
      const message = payload?.error?.message ?? response.statusText;
      this.logger.error(`Cloudinary upload failed: ${message}`);
      throw new Error(`CLOUDINARY_UPLOAD_FAILED: ${message}`);
    }

    return {
      secureUrl: payload.secure_url,
      publicId: payload.public_id,
      resourceType: payload.resource_type ?? resourceType,
      bytes: payload.bytes ?? input.buffer.length,
    };
  }

  createPrivateDownloadUrl(
    secureUrl: string,
    attachmentName?: string,
  ): CloudinaryDownloadUrl {
    const config = this.readConfig();
    this.configureSdk(config);

    const parsed = this.parseDeliveryUrl(secureUrl, config.cloudName);
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const fileName = attachmentName?.trim() || parsed.fileName;

    return {
      url: cloudinary.utils.private_download_url(
        parsed.publicId,
        (parsed.resourceType === 'raw' ? undefined : parsed.format) as string,
        {
          resource_type: parsed.resourceType,
          type: parsed.deliveryType,
          attachment: true,
          expires_at: expiresAt,
        },
      ),
      fileName,
    };
  }

  private readConfig(): CloudinaryConfig {
    const cloudinaryUrl = this.readEnv('CLOUDINARY_URL');
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

    const cloudName = this.readEnv('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.readEnv('CLOUDINARY_API_KEY');
    const apiSecret = this.readEnv('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('CLOUDINARY_CONFIG_MISSING');
    }

    return { cloudName, apiKey, apiSecret };
  }

  private configureSdk(config: CloudinaryConfig): void {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  private parseDeliveryUrl(
    secureUrl: string,
    expectedCloudName: string,
  ): {
    resourceType: string;
    deliveryType: string;
    publicId: string;
    format: string;
    fileName: string;
  } {
    const url = new URL(secureUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const cloudNameIndex = parts.indexOf(expectedCloudName);
    const resourceType = parts[cloudNameIndex + 1];
    const deliveryType = parts[cloudNameIndex + 2];
    const uploadSegments = parts.slice(cloudNameIndex + 3);
    const versionIndex = uploadSegments.findIndex((part) => /^v\d+$/.test(part));
    const publicIdSegments =
      versionIndex >= 0 ? uploadSegments.slice(versionIndex + 1) : uploadSegments;
    const lastSegment = publicIdSegments.at(-1) ?? 'media';
    const parsedName = parse(lastSegment);
    const format = parsedName.ext.replace(/^\./, '');

    if (!resourceType || !deliveryType || publicIdSegments.length === 0 || !format) {
      throw new Error('CLOUDINARY_DELIVERY_URL_INVALID');
    }

    const isRawResource = resourceType === 'raw';
    const publicId = isRawResource
      ? publicIdSegments.join('/')
      : [
          ...publicIdSegments.slice(0, -1),
          parsedName.name,
        ].join('/');

    return {
      resourceType,
      deliveryType,
      publicId,
      format,
      fileName: decodeURIComponent(lastSegment),
    };
  }

  private readEnv(key: string): string {
    return (
      this.configService.get<string>(key)?.trim() ??
      process.env[key]?.trim() ??
      ''
    );
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
    return `${this.slug(name)}-${Date.now()}-${randomUUID()}`;
  }

  private resourceTypeFor(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'video';
    return 'raw';
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
