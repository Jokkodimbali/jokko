import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import QRCode from 'qrcode';
import {
  buildParcelQrUrl,
  parcelQrReference,
} from '../../pages/appointment-qr-code-page/parcel-qr-token.util';

@Component({
  selector: 'app-parcel-pickup-qr-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './parcel-pickup-qr-card.component.html',
  styleUrl: './parcel-pickup-qr-card.component.scss',
})
export class ParcelPickupQrCardComponent implements OnChanges {
  @Input({ required: true }) reservationId = '';
  @Input({ required: true }) serviceId = '';
  @Input({ required: true }) itemLabel = '';
  @Input({ required: true }) pickupTitle = '';

  protected readonly imageUrl = signal<string | null>(null);
  protected readonly manualCode = signal('');
  protected readonly hasError = signal(false);

  ngOnChanges(): void {
    void this.generateQrCode();
  }

  protected downloadQrCode(): void {
    const imageUrl = this.imageUrl();
    if (!imageUrl || typeof document === 'undefined') return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `jokko-retrait-${this.manualCode() || 'colis'}.png`;
    link.click();
  }

  private async generateQrCode(): Promise<void> {
    this.imageUrl.set(null);
    this.hasError.set(false);
    if (!this.reservationId || !this.serviceId || typeof window === 'undefined') return;

    try {
      this.manualCode.set(parcelQrReference(this.reservationId, this.serviceId));
      const value = buildParcelQrUrl({
        reservationId: this.reservationId,
        serviceId: this.serviceId,
        checkpoint: 'RETRAIT',
        origin: window.location.origin,
      });
      this.imageUrl.set(
        await QRCode.toDataURL(value, {
          errorCorrectionLevel: 'M',
          margin: 2,
          scale: 8,
          color: { dark: '#111827', light: '#ffffff' },
        }),
      );
    } catch {
      this.hasError.set(true);
    }
  }
}
