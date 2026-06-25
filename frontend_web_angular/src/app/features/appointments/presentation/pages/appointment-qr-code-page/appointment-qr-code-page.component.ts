import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import QRCode from 'qrcode';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentView } from '../../../domain/appointments.models';

type QrMode = 'expediteur' | 'destinataire';

interface QrStep {
  icon: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-appointment-qr-code-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './appointment-qr-code-page.component.html',
  styleUrl: './appointment-qr-code-page.component.scss',
})
export class AppointmentQrCodePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly appointmentsService = inject(AppointmentsService);

  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly mode = signal<QrMode>('expediteur');
  protected readonly qrImageUrl = signal<string | null>(null);

  protected readonly title = computed(() =>
    this.mode() === 'expediteur' ? 'Retrait de Colis' : 'Depot de Colis',
  );
  protected readonly targetRoleLabel = computed(() =>
    this.mode() === 'expediteur' ? 'expediteur' : 'destinataire',
  );
  protected readonly targetName = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return '';

    if (this.mode() === 'expediteur') {
      return this.extractNamedValue(appointment.notes, 'expediteur') || appointment.clientName;
    }

    return (
      this.extractNamedValue(appointment.notes, 'destinataire') ||
      this.extractNamedValue(appointment.notes, 'recepteur') ||
      appointment.clientName
    );
  });
  protected readonly parcelNumber = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return 'FR-----';

    const explicitCode = this.extractParcelCode(appointment.notes);
    if (explicitCode) return explicitCode;

    const compact = appointment.id.replace(/-/g, '').toUpperCase();
    const first = compact.slice(0, 4) || '0000';
    const last = compact.slice(-5) || '00000';
    const year = new Date(appointment.scheduledAt).getFullYear() || new Date().getFullYear();
    return `FR-${year}-${first}${last}-X`;
  });
  protected readonly infoText = computed(() => {
    const name = this.targetName() || `le ${this.targetRoleLabel()}`;
    const action =
      this.mode() === 'expediteur'
        ? 'le transmettre au destinataire afin que le livreur puisse le scanner avant de deposer votre colis.'
        : 'le presenter ou le transmettre au destinataire afin que le livreur puisse le scanner avant de deposer votre colis.';

    return `QR code de ${name}. Vous devez ${action}`;
  });
  protected readonly sideNotice = computed(() =>
    this.mode() === 'expediteur'
      ? "Veuillez presenter ce QR code a l'expediteur pour valider le retrait de votre colis."
      : 'Veuillez presenter ce QR code au destinataire pour valider le depot de votre colis.',
  );
  protected readonly statusLabel = computed(() =>
    this.mode() === 'expediteur'
      ? 'En attente de validation retrait'
      : 'En attente de validation livraison',
  );
  protected readonly steps = computed<QrStep[]>(() => {
    const role = this.targetRoleLabel();
    const action = this.mode() === 'expediteur' ? 'retire' : 'remis';
    return [
      {
        icon: 'smartphone',
        title: 'ETAPE 1',
        text: `Transmettez ce QR code au ${role}`,
      },
      {
        icon: 'maximize-2',
        title: 'ETAPE 2',
        text: `Le livreur scanne le QR code pour confirmer l'identite du ${role}.`,
      },
      {
        icon: 'archive',
        title: 'ETAPE 3',
        text: `Votre colis est ${action} une fois la validation effectuee.`,
      },
    ];
  });
  protected readonly qrPayload = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return '';

    return JSON.stringify({
      type: `JOKKO_PARCEL_${this.mode().toUpperCase()}`,
      reservationId: appointment.id,
      parcelNumber: this.parcelNumber(),
      holderName: this.targetName(),
      serviceId: appointment.serviceId,
      scheduledAt: appointment.scheduledAt,
      checksum: this.checksum(
        `${appointment.id}:${this.mode()}:${this.parcelNumber()}:${this.targetName()}`,
      ),
    });
  });
  ngOnInit(): void {
    const type = this.route.snapshot.paramMap.get('type');
    this.mode.set(type === 'destinataire' ? 'destinataire' : 'expediteur');

    const reservationId = this.route.snapshot.paramMap.get('id');
    if (!reservationId) {
      this.isLoading.set(false);
      this.errorMessage.set('Reservation introuvable.');
      return;
    }

    this.appointmentsService.getAppointmentById(reservationId).subscribe({
      next: (appointment) => {
        if (appointment.travelMode !== 'TRANSPORT_COLIS') {
          this.isLoading.set(false);
          this.errorMessage.set(
            'Les QR codes expediteur et destinataire sont reserves au transport de colis.',
          );
          return;
        }

        this.appointment.set(appointment);
        void this.generateQrImage();
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Impossible de charger le QR code de ce colis.');
      },
    });
  }

  protected goBack(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const reservationId = this.route.snapshot.paramMap.get('id');
    this.backNavigation.back(returnUrl, reservationId ? `/appointments/${reservationId}` : '/appointments');
  }

  protected downloadQrPdf(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  protected trackByIndex(index: number): number {
    return index;
  }

  private async generateQrImage(): Promise<void> {
    const payload = this.qrPayload();
    if (!payload) {
      this.qrImageUrl.set(null);
      this.isLoading.set(false);
      this.errorMessage.set('Donnees de reservation insuffisantes pour generer le QR code.');
      return;
    }

    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 9,
        color: {
          dark: '#111111',
          light: '#ffffff',
        },
      });
      this.qrImageUrl.set(dataUrl);
      this.isLoading.set(false);
    } catch {
      this.qrImageUrl.set(null);
      this.isLoading.set(false);
      this.errorMessage.set('Impossible de generer le QR code localement.');
    }
  }

  private extractNamedValue(notes: string | null, key: string): string | null {
    if (!notes) return null;
    const pattern = new RegExp(`${key}\\s*[:=-]\\s*([^;\\n,]+)`, 'i');
    const match = notes.match(pattern);
    return match?.[1]?.trim() || null;
  }

  private extractParcelCode(notes: string | null): string | null {
    if (!notes) return null;
    const explicit = notes.match(/(?:colis|parcel|code)\s*[:=-]\s*([A-Z0-9-]{5,})/i);
    if (explicit?.[1]) return explicit[1].trim().toUpperCase();
    const fallback = notes.match(/\b[A-Z0-9]{5,}(?:-[A-Z0-9]{2,})*\b/i);
    return fallback?.[0]?.trim().toUpperCase() || null;
  }

  private checksum(value: string): number {
    return value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 99991, 17);
  }
}
