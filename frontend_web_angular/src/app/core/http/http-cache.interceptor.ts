import {
  HttpContextToken,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export const SKIP_HTTP_CACHE = new HttpContextToken<boolean>(() => false);

type CacheEntry = {
  expiresAt: number;
  response: HttpResponse<unknown>;
};

const DEFAULT_TTL_MS = 12_000;
const LONG_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 120;
const cache = new Map<string, CacheEntry>();

export function clearHttpResponseCache(): void {
  cache.clear();
}

export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApplicationApiRequest(req.url)) {
    return next(req);
  }

  if (isMutatingRequest(req)) {
    cache.clear();
    return next(req);
  }

  if (!isCacheableRequest(req)) {
    return next(req);
  }

  const key = cacheKey(req);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return of(cached.response.clone()) as Observable<HttpEvent<unknown>>;
  }

  if (cached) {
    cache.delete(key);
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status >= 200 && event.status < 300) {
        remember(key, event, now + ttlFor(req.url));
      }
    }),
  );
};

function isCacheableRequest(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET' || req.context.get(SKIP_HTTP_CACHE)) {
    return false;
  }

  const path = requestPath(req.url);
  if (!path) {
    return false;
  }

  return ![
    '/auth/',
    '/conversations',
    '/messages',
    '/notifications',
    '/live-tracking',
    '/tracking',
    '/presence',
    '/payments/wallet',
  ].some((fragment) => path.includes(fragment));
}

function isMutatingRequest(req: HttpRequest<unknown>): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
}

function cacheKey(req: HttpRequest<unknown>): string {
  const authorization = req.headers.get('Authorization') ?? '';
  return `${authorization}|${req.method}|${req.urlWithParams}`;
}

function remember(key: string, response: HttpResponse<unknown>, expiresAt: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    expiresAt,
    response: response.clone(),
  });
}

function ttlFor(requestUrl: string): number {
  const path = requestPath(requestUrl) ?? '';
  return path.includes('/categories') || path.includes('/maps/config')
    ? LONG_TTL_MS
    : DEFAULT_TTL_MS;
}

function requestPath(requestUrl: string): string | null {
  if (!/^https?:\/\//i.test(requestUrl)) {
    return requestUrl;
  }

  try {
    return new URL(requestUrl).pathname;
  } catch {
    return null;
  }
}

function isApplicationApiRequest(requestUrl: string): boolean {
  const apiUrl = environment.apiUrl;

  if (!/^https?:\/\//i.test(requestUrl)) {
    return requestUrl.startsWith('/api/');
  }

  try {
    const request = new URL(requestUrl);
    const api = new URL(apiUrl);
    return request.origin === api.origin && request.pathname.startsWith(api.pathname);
  } catch {
    return false;
  }
}
