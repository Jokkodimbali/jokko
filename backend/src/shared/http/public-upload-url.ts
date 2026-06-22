import type { Request } from 'express';

const LOCAL_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i;

export function buildPublicUploadUrl(
  request: Request,
  uploadPath: string,
): string {
  const cleanPath = uploadPath.startsWith('/') ? uploadPath : `/${uploadPath}`;
  const configuredBaseUrl =
    process.env.UPLOADS_PUBLIC_BASE_URL ||
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL;

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/+$/, '')}${cleanPath}`;
  }

  const forwardedProto = firstHeaderValue(request.headers['x-forwarded-proto']);
  const forwardedHost = firstHeaderValue(request.headers['x-forwarded-host']);
  const host = forwardedHost || request.get('host') || 'localhost:3000';
  const hostname = host.split(':')[0] ?? host;
  const protocol = forwardedProto || request.protocol || 'http';
  const isHttpsRequest =
    protocol === 'https' ||
    request.secure ||
    firstHeaderValue(request.headers['x-forwarded-ssl']) === 'on';
  const safeProtocol =
    isHttpsRequest || !LOCAL_HOST_PATTERN.test(hostname) ? 'https' : protocol;

  return `${safeProtocol}://${host}${cleanPath}`;
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.split(',')[0]?.trim() || null;
  }
  return value?.split(',')[0]?.trim() || null;
}
