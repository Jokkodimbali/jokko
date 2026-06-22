import { environment } from '../../../environments/environment';

const LOCAL_HTTP_ASSET_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?(\/.*)$/i;

export function publicAssetUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;

  const localMatch = value.match(LOCAL_HTTP_ASSET_PATTERN);
  const localPath = localMatch?.[4];
  if (localPath?.includes('/uploads/')) {
    return `${new URL(environment.apiUrl).origin}${localPath.slice(localPath.indexOf('/uploads/'))}`;
  }

  if (/^https:\/\//i.test(value) || value.startsWith('//')) return value;
  if (/^http:\/\//i.test(value)) return null;
  if (value.startsWith('/')) return `${new URL(environment.apiUrl).origin}${value}`;

  return value;
}
