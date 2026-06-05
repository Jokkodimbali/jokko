import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppFeedbackService } from '../feedback/app-feedback.service';
import { AuthSessionService } from './auth-session.service';

type AppRole = 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN' | 'ADMIN';

const LOGIN_REQUIRED_MESSAGE =
  'Connectez-vous d abord pour acceder a cet espace.';

function redirectToLogin(router: Router, url: string) {
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: url },
  });
}

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);
  const feedback = inject(AppFeedbackService);

  if (authSession.hasAuthenticatedSession()) {
    return true;
  }

  feedback.info(LOGIN_REQUIRED_MESSAGE);
  return redirectToLogin(router, state.url);
};

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);
  const feedback = inject(AppFeedbackService);
  const allowedRoles = (route.data?.['roles'] ?? []) as AppRole[];

  if (!authSession.hasAuthenticatedSession()) {
    feedback.info(LOGIN_REQUIRED_MESSAGE);
    return redirectToLogin(router, state.url);
  }

  const role = authSession.getAuthenticatedRole() as AppRole | null;
  if (allowedRoles.length === 0 || (role && allowedRoles.includes(role))) {
    return true;
  }

  feedback.error('Votre compte n a pas les droits necessaires pour acceder a cet espace.');
  return router.createUrlTree(['/services']);
};
