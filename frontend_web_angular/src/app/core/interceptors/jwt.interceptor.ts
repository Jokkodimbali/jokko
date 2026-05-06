import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthSessionService } from '../auth/auth-session.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthSessionService).accessToken;

  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
    return next(authReq);
  }

  return next(req);
};
