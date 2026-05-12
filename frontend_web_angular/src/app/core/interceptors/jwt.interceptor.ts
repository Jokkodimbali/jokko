import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authSession = inject(AuthSessionService);
  const token = authSession.getAccessToken();

  const headers = token
    ? req.headers.set('Authorization', `Bearer ${token}`)
    : req.headers;

  return next(req.clone({
    headers,
    withCredentials: true
  })).pipe(
    catchError((error) => {
      if (error?.status === 401) {
        authSession.clear();
      }

      return throwError(() => error);
    }),
  );
};
