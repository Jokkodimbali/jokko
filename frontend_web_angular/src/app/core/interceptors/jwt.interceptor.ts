import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, EMPTY, catchError, filter, finalize, switchMap, take, throwError } from 'rxjs';
import { AppFeedbackService } from '../feedback/app-feedback.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { AuthService } from '../../features/auth/data-access/auth.service';
import { getHttpErrorMessage } from '../http/api-response.utils';

let refreshInProgress = false;
const refreshTokenSignal = new BehaviorSubject<string | 'FAILED' | null>(null);
const SESSION_EXPIRED_MESSAGE =
  'Votre session a expire. Reconnectez-vous pour continuer.';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authSession = inject(AuthSessionService);
  const feedback = inject(AppFeedbackService);
  const router = inject(Router);
  const authService = inject(AuthService);
  const token = authSession.getAccessToken();

  const headers = token
    ? req.headers.set('Authorization', `Bearer ${token}`)
    : req.headers;

  return next(req.clone({
    headers,
    withCredentials: true
  })).pipe(
    catchError((error) => {
      if (error?.status === 401 && shouldHandleUnauthorized(req.url, router.url)) {
        if (refreshInProgress) {
          return refreshTokenSignal.pipe(
            filter((refreshedToken): refreshedToken is string | 'FAILED' => refreshedToken !== null),
            take(1),
            switchMap((refreshedToken) => {
              if (refreshedToken === 'FAILED') {
                handleExpiredSession(authSession, feedback, router);
                return EMPTY;
              }

              return next(req.clone({
                headers: req.headers.set('Authorization', `Bearer ${refreshedToken}`),
                withCredentials: true,
              }));
            }),
            catchError(() => {
              handleExpiredSession(authSession, feedback, router);
              return EMPTY;
            }),
          );
        }

        refreshInProgress = true;
        refreshTokenSignal.next(null);

        return authService.refresh().pipe(
          switchMap((response) => {
            authSession.saveAuthResponse(response, authSession.isRememberMeEnabled());
            const refreshedToken = authSession.getAccessToken();
            refreshTokenSignal.next(refreshedToken);
            const retryHeaders = refreshedToken
              ? req.headers.set('Authorization', `Bearer ${refreshedToken}`)
              : req.headers.delete('Authorization');

            return next(req.clone({
              headers: retryHeaders,
              withCredentials: true,
            }));
          }),
          catchError(() => {
            refreshTokenSignal.next('FAILED');
            handleExpiredSession(authSession, feedback, router);
            return EMPTY;
          }),
          finalize(() => {
            refreshInProgress = false;
          }),
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

  return ![
    '/auth/login',
    '/auth/google/login',
    '/auth/register',
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/refresh',
  ].some((path) => requestUrl.includes(path));
}
