import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

/** Providers manage tender responses exclusively from the cards in their inbox. */
export const tenderClientDetailGuard: CanActivateFn = () =>
  inject(AuthSessionService).getAuthenticatedRole() === 'PRESTATAIRE'
    ? inject(Router).createUrlTree(['/appels-offres'])
    : true;
