import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TabSessionStorageService {
  private readonly platformId = inject(PLATFORM_ID);

  get(key: string): string | null {
    return isPlatformBrowser(this.platformId) ? sessionStorage.getItem(key) : null;
  }

  set(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) sessionStorage.setItem(key, value);
  }

  remove(key: string): void {
    if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem(key);
  }
}
