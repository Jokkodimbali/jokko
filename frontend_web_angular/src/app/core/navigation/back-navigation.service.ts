import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { safeInternalUrl } from '../../shared/utils/safe-internal-url';

@Injectable({ providedIn: 'root' })
export class BackNavigationService {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  back(
    returnUrl: string | null | undefined,
    fallbackUrl: string,
    options: { preferReturnUrl?: boolean } = {},
  ): void {
    const target = safeInternalUrl(returnUrl) ?? fallbackUrl;
    if (options.preferReturnUrl) {
      void this.router.navigateByUrl(target, { replaceUrl: true });
      return;
    }

    if (this.hasApplicationHistory()) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private hasApplicationHistory(): boolean {
    if (typeof window === 'undefined') return false;
    const navigationId = Number(window.history.state?.navigationId ?? 0);
    return navigationId > 1;
  }
}
