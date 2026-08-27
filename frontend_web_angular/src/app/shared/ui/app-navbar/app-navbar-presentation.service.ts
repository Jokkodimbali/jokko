import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppNavbarPresentationService {
  readonly mobileLocationLabel = signal('Votre localisation');

  setMobileLocationLabel(label: string): void {
    this.mobileLocationLabel.set(label.trim() || 'Votre localisation');
  }
}
