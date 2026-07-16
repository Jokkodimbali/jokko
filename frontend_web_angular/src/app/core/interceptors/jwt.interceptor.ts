import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  filter,
  finalize,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { AppFeedbackService } from '../feedback/app-feedback.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { AuthService } from '../../features/auth/data-access/auth.service';
import { getHttpErrorMessage } from '../http/api-response.utils';
import { environment } from '../../../environments/environment';

let refreshInProgress = false;
type RefreshTokenSignalValue = string | 'EXPIRED' | 'RETRYABLE_FAILED';
const refreshTokenSignal = new BehaviorSubject<RefreshTokenSignalValue | null>(null);
let lastRefreshFailure: unknown = null;
const SESSION_EXPIRED_MESSAGE =
  'Votre session a expire. Reconnectez-vous pour continuer.';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authSession = inject(AuthSessionService);
  const feedback = inject(AppFeedbackService);
  const router = inject(Router);
  const authService = inject(AuthService);
  const token = authSession.getAccessToken();
  const isApiRequest = isApplicationApiRequest(req.url);

  if (!isApiRequest) {
    return next(req);
  }

  const headers = token
    ? req.headers.set('Authorization', `Bearer ${token}`)
    : req.headers;
  const authenticatedRequest = req.clone({
    headers,
    withCredentials: true,
  });

  if (
    token &&
    authSession.isAccessTokenExpiring() &&
    shouldHandleUnauthorized(req.url, router.url)
  ) {
    return refreshAndRetry(
      authenticatedRequest,
      next,
      authSession,
      authService,
      feedback,
      router,
    );
  }

  return next(authenticatedRequest).pipe(
    catchError((error) => {
      if (error?.status === 401 && shouldHandleUnauthorized(req.url, router.url)) {
        return refreshAndRetry(
          authenticatedRequest,
          next,
          authSession,
          authService,
          feedback,
          router,
        );
      }

      if (error?.status === 403) {
        feedback.error(getHttpErrorMessage(error, 'Vous n avez pas les droits necessaires pour cette action.'));
      } else if (error?.status === 0) {
        feedback.error('Connexion au serveur impossible. Verifiez votre reseau puis reessayez.');
      } else if (error?.status >= 500) {
        feedback.error(getHttpErrorMessage(error, 'Le serveur est momentanement indisponible.'));
      }

      return throwError(() => error);
    }),
  );
};

function refreshAndRetry(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authSession: AuthSessionService,
  authService: AuthService,
  feedback: AppFeedbackService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  if (refreshInProgress) {
    return refreshTokenSignal.pipe(
      filter(
        (refreshedToken): refreshedToken is RefreshTokenSignalValue =>
          refreshedToken !== null,
      ),
      take(1),
      switchMap((refreshedToken) => {
        if (refreshedToken === 'EXPIRED') {
          handleExpiredSession(authSession, feedback, router);
          return EMPTY;
        }

        if (refreshedToken === 'RETRYABLE_FAILED') {
          return throwError(() => lastRefreshFailure ?? new Error('Refresh temporairement indisponible.'));
        }

        return next(withAccessToken(request, refreshedToken));
      }),
    );
  }

  refreshInProgress = true;
  refreshTokenSignal.next(null);

  return authService.refresh().pipe(
    switchMap((response) => {
      authSession.saveAuthResponse(
        response,
        authSession.isRememberMeEnabled(),
      );
      const refreshedToken = authSession.getAccessToken();
      if (!refreshedToken) {
        refreshTokenSignal.next('EXPIRED');
        handleExpiredSession(authSession, feedback, router);
        return EMPTY;
      }

      lastRefreshFailure = null;
      refreshTokenSignal.next(refreshedToken);
      return next(withAccessToken(request, refreshedToken));
    }),
    catchError((error) => {
      lastRefreshFailure = error;
      if (isRefreshTokenInvalidError(error)) {
        const latestToken = authSession.getAccessToken();
        if (latestToken && latestToken !== readBearerToken(request)) {
          lastRefreshFailure = null;
          refreshTokenSignal.next(latestToken);
          return next(withAccessToken(request, latestToken));
        }

        refreshTokenSignal.next('EXPIRED');
        handleExpiredSession(authSession, feedback, router);
        return EMPTY;
      }

      refreshTokenSignal.next('RETRYABLE_FAILED');
      return throwError(() => error);
    }),
    finalize(() => {
      refreshInProgress = false;
    }),
  );
}

function withAccessToken(
  request: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return request.clone({
    headers: request.headers.set('Authorization', `Bearer ${token}`),
    withCredentials: true,
  });
}

function readBearerToken(request: HttpRequest<unknown>): string | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

function isRefreshTokenInvalidError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const status = (error as { status?: unknown }).status;
  const body = (error as { error?: { errorCode?: unknown } }).error;
  const errorCode = typeof body?.errorCode === 'string' ? body.errorCode : '';

  return status === 401 && errorCode === 'AUTH_REFRESH_TOKEN_INVALID';
}

function handleExpiredSession(
  authSession: AuthSessionService,
  feedback: AppFeedbackService,
  router: Router,
): void {
  authSession.clear();
  feedback.info(SESSION_EXPIRED_MESSAGE);

  if (!router.url.startsWith('/auth/login')) {
    router.navigate(['/auth/login'], {
      queryParams: { returnUrl: router.url === '/auth/login' ? '/services' : router.url },
    });
  }
}

function shouldHandleUnauthorized(requestUrl: string, currentUrl: string): boolean {
  if (currentUrl.startsWith('/auth/login')) {
    return false;
  }

  if (!isApplicationApiRequest(requestUrl)) {
    return false;
  }

  return ![
    '/auth/login',
    '/auth/google/login',
    '/auth/register',
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/refresh',
  ].some((path) => requestUrl.includes(path));
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
