import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';
import { AppFeedbackService } from '../feedback/app-feedback.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { AuthService } from '../../features/auth/data-access/auth.service';

let refreshInProgress = false;

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
          return throwError(() => error);
        }

        refreshInProgress = true;

        return authService.refresh().pipe(
          switchMap((response) => {
            authSession.saveAuthResponse(response, authSession.isRememberMeEnabled());
            const refreshedToken = authSession.getAccessToken();
            const retryHeaders = refreshedToken
              ? req.headers.set('Authorization', `Bearer ${refreshedToken}`)
              : req.headers.delete('Authorization');

            return next(req.clone({
              headers: retryHeaders,
              withCredentials: true,
            }));
          }),
          catchError((refreshError) => {
            authSession.clear();
            feedback.info('Votre session a expire ou vous devez vous connecter pour continuer.');
            if (isProtectedPage(router.url)) {
              router.navigate(['/auth/login'], {
                queryParams: { returnUrl: router.url === '/auth/login' ? '/services' : router.url },
              });
            }
            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshInProgress = false;
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};

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

function isProtectedPage(currentUrl: string): boolean {
  const path = currentUrl.split('?')[0] || '/';

  if (path === '/medecine/espace' || path === '/prestataire/espace') {
    return true;
  }

  return [
    '/admin',
    '/appointments',
    '/favorites',
    '/litiges',
    '/messages',
    '/settings',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
