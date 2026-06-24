import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class BackNavigationService {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  back(returnUrl: string | null | undefined, fallbackUrl: string): void {
    if (this.hasApplicationHistory()) {
      this.location.back();
      return;
    }

    const target = this.safeInternalUrl(returnUrl) ?? fallbackUrl;
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private hasApplicationHistory(): boolean {
    if (typeof window === 'undefined') return false;
    const navigationId = Number(window.history.state?.navigationId ?? 0);
    return navigationId > 1;
  }

  private safeInternalUrl(value: string | null | undefined): string | null {
    const url = value?.trim();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
