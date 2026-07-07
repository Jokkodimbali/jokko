import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import QRCode from 'qrcode';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentView } from '../../../domain/appointments.models';

type QrMode = 'expediteur' | 'destinataire';
type ParcelCheckpoint = 'RETRAIT' | 'DEPOT';

interface QrStep {
  icon: string;
  title: string;
  text: string;
}

interface ParcelLine {
  index: number;
  number: string;
  description: string;
}

interface ParcelManifest {
  deliveryType: string;
  pickupName: string;
  pickupPhone: string;
  pickupAddress: string;
  dropoffName: string;
  dropoffPhone: string;
  dropoffAddress: string;
  parcels: ParcelLine[];
  note: string;
}

@Component({
  selector: 'app-appointment-qr-code-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './appointment-qr-code-page.component.html',
  styleUrl: './appointment-qr-code-page.component.scss',
})
export class AppointmentQrCodePageComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('cameraPreview')
  set cameraPreviewRef(value: ElementRef<HTMLVideoElement> | undefined) {
    this.cameraVideo = value?.nativeElement;
    if (this.cameraVideo && this.scanMode() && this.isDeliveryPersonView()) {
      window.setTimeout(() => void this.startCamera(), 0);
    }
  }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly authSession = inject(AuthSessionService);
  private cameraVideo?: HTMLVideoElement;
  private cameraStream?: MediaStream;
  private cameraScanIntervalId?: number;
  private barcodeDetector?: { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> };

  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly mode = signal<QrMode>('expediteur');
  protected readonly scanMode = signal(false);
  protected readonly qrImageUrl = signal<string | null>(null);
  protected readonly scannedPayload = signal('');
  protected readonly validationMessage = signal<string | null>(null);
  protected readonly validationError = signal<string | null>(null);
  protected readonly isCameraActive = signal(false);
  protected readonly isCameraStarting = signal(false);
  protected readonly cameraError = signal<string | null>(null);

  protected readonly title = computed(() =>
    this.scanMode()
      ? this.mode() === 'expediteur'
        ? 'Reception de Colis'
        : 'Deposer le colis'
      : this.mode() === 'expediteur'
      ? 'Retrait de Colis'
      : 'Depot de Colis',
  );
  protected readonly checkpoint = computed<ParcelCheckpoint>(() =>
    this.mode() === 'expediteur' ? 'RETRAIT' : 'DEPOT',
  );
  protected readonly targetRoleLabel = computed(() =>
    this.mode() === 'expediteur' ? 'expediteur' : 'destinataire',
  );
  protected readonly targetRoleDisplay = computed(() =>
    this.mode() === 'expediteur' ? 'EXPEDITEUR' : 'DESTINATAIRE',
  );
  protected readonly manifest = computed(() => this.parseParcelManifest(this.appointment()?.notes ?? null));
  protected readonly targetName = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return '';

    if (this.mode() === 'expediteur') {
      return this.manifest().pickupName || appointment.clientName;
    }

    return this.manifest().dropoffName || appointment.clientName;
  });
  protected readonly parcelNumber = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return 'FR-----';

    const parcelNumbers = this.manifest().parcels.map((parcel) => parcel.number).filter(Boolean);
    if (parcelNumbers.length === 1) return parcelNumbers[0];
    if (parcelNumbers.length > 1) return `${parcelNumbers[0]} +${parcelNumbers.length - 1}`;

    const compact = appointment.id.replace(/-/g, '').toUpperCase();
    const first = compact.slice(0, 4) || '0000';
    const last = compact.slice(-5) || '00000';
    const year = new Date(appointment.scheduledAt).getFullYear() || new Date().getFullYear();
    return `FR-${year}-${first}${last}-X`;
  });
  protected readonly parcelCountLabel = computed(() => {
    const count = this.manifest().parcels.length;
    return count > 1 ? `${count} colis` : '1 colis';
  });
  protected readonly infoText = computed(() => {
    const name = this.targetName() || `le ${this.targetRoleLabel()}`;
    const action =
      this.mode() === 'expediteur'
        ? "le presenter a l'expediteur afin que le livreur puisse confirmer le retrait avant de partir."
        : 'le presenter ou le transmettre au destinataire afin que le livreur puisse le scanner avant de deposer votre colis.';

    return `QR code de ${name}. Vous devez ${action}`;
  });
  protected readonly sideNotice = computed(() =>
    this.scanMode()
      ? this.mode() === 'expediteur'
        ? "Scannez le QR code presente par l'expediteur pour confirmer la prise en charge du colis."
        : 'Scannez le QR code presente par le destinataire pour confirmer le depot du colis.'
      : this.mode() === 'expediteur'
      ? "Veuillez presenter ce QR code a l'expediteur pour valider le retrait de votre colis."
      : 'Veuillez presenter ce QR code au destinataire pour valider le depot de votre colis.',
  );
  protected readonly statusLabel = computed(() =>
    this.mode() === 'expediteur'
      ? 'En attente de validation'
      : 'En attente de validation',
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
    const manifest = this.manifest();
    const payload = {
      issuer: 'JOKKO',
      version: 1,
      type: 'JOKKO_PARCEL_CHECKPOINT',
      checkpoint: this.checkpoint(),
      reservationId: appointment.id,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      scheduledAt: appointment.scheduledAt,
      parcelReference: this.parcelNumber(),
      parcels: manifest.parcels,
      pickup: {
        name: manifest.pickupName || appointment.clientName,
        phone: manifest.pickupPhone || appointment.clientPhone,
        address: manifest.pickupAddress,
      },
      dropoff: {
        name: manifest.dropoffName || appointment.clientName,
        phone: manifest.dropoffPhone || appointment.clientPhone,
        address: manifest.dropoffAddress || appointment.addressLabel,
      },
      generatedAt: new Date().toISOString(),
    };

    return JSON.stringify({
      ...payload,
      checksum: this.payloadChecksum(payload),
    });
  });
  protected readonly isDeliveryPersonView = computed(() => {
    const role = this.authSession.currentUser()?.role;
    return role === 'PRESTATAIRE' || role === 'MEDECIN';
  });
  protected readonly validationStorageKey = computed(() => {
    const appointment = this.appointment();
    return appointment ? `jokko:parcel:${appointment.id}:${this.checkpoint()}` : '';
  });
  protected readonly isCheckpointValidated = computed(() => {
    const key = this.validationStorageKey();
    return !!key && globalThis.localStorage?.getItem(key) === 'validated';
  });
  ngOnInit(): void {
    const type = this.route.snapshot.paramMap.get('type');
    this.mode.set(type === 'destinataire' ? 'destinataire' : 'expediteur');
    this.scanMode.set(this.route.snapshot.queryParamMap.get('scan') === '1');

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
        this.restoreValidationState();
        void this.generateQrImage();
        if (this.scanMode() && this.isDeliveryPersonView()) {
          window.setTimeout(() => void this.startCamera(), 120);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Impossible de charger le QR code de ce colis.');
      },
    });
  }

  ngAfterViewInit(): void {
    if (this.scanMode() && this.isDeliveryPersonView()) {
      window.setTimeout(() => void this.startCamera(), 0);
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
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

  protected switchMode(mode: QrMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.validationMessage.set(null);
    this.validationError.set(null);
    this.scannedPayload.set('');
    void this.generateQrImage();
  }

  protected updateScannedPayload(value: string): void {
    this.scannedPayload.set(value);
    this.validationError.set(null);
    this.validationMessage.set(null);
  }

  protected async startCamera(): Promise<void> {
    if (!this.scanMode() || !this.isDeliveryPersonView() || this.isCameraActive() || this.isCameraStarting()) {
      return;
    }
    if (!this.cameraVideo) return;
    if (!this.canUseCameraInCurrentContext()) {
      this.cameraError.set(
        "La camera est disponible uniquement en HTTPS ou sur localhost. Ouvrez l'application depuis localhost ou une URL securisee.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set(
        "Ce navigateur ne permet pas d'activer la camera. Utilisez la saisie manuelle du QR code.",
      );
      return;
    }

    this.isCameraStarting.set(true);
    this.cameraError.set(null);

    try {
      const stream = await this.openCameraStream();
      this.cameraStream = stream;
      this.cameraVideo.srcObject = stream;
      await this.cameraVideo.play();
      this.isCameraActive.set(true);
      this.prepareBarcodeDetector();
      this.startCameraLoop();
    } catch (error) {
      this.cameraError.set(this.cameraActivationErrorMessage(error));
    } finally {
      this.isCameraStarting.set(false);
    }
  }

  protected stopCamera(): void {
    if (this.cameraScanIntervalId) {
      window.clearInterval(this.cameraScanIntervalId);
      this.cameraScanIntervalId = undefined;
    }
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;
    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null;
    }
    this.isCameraActive.set(false);
  }

  protected validateScannedQr(): void {
    const appointment = this.appointment();
    if (!appointment) return;

    const rawPayload = this.scannedPayload().trim();
    if (!rawPayload) {
      this.validationError.set('Scannez ou collez le contenu du QR code avant de valider.');
      return;
    }

    if (!rawPayload.startsWith('{')) {
      this.validateManualParcelReference(rawPayload);
      return;
    }

    try {
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      const expectedChecksum = this.payloadChecksum({
        issuer: payload['issuer'],
        version: payload['version'],
        type: payload['type'],
        checkpoint: payload['checkpoint'],
        reservationId: payload['reservationId'],
        serviceId: payload['serviceId'],
        serviceName: payload['serviceName'],
        scheduledAt: payload['scheduledAt'],
        parcelReference: payload['parcelReference'],
        parcels: payload['parcels'],
        pickup: payload['pickup'],
        dropoff: payload['dropoff'],
        generatedAt: payload['generatedAt'],
      });

      if (
        payload['type'] !== 'JOKKO_PARCEL_CHECKPOINT' ||
        payload['reservationId'] !== appointment.id ||
        payload['checkpoint'] !== this.checkpoint() ||
        payload['checksum'] !== expectedChecksum
      ) {
        this.validationError.set('QR code invalide ou non conforme a cette reservation.');
        return;
      }

      const key = this.validationStorageKey();
      if (key) {
        globalThis.localStorage?.setItem(key, 'validated');
      }
      this.stopCamera();
      this.validationMessage.set(
        this.mode() === 'expediteur'
          ? 'Retrait confirme. Les informations colis correspondent a cette reservation.'
          : 'Depot confirme. Les informations colis correspondent a cette reservation.',
      );
      this.validationError.set(null);
    } catch {
      this.validationError.set('Le QR code scanne est illisible ou incomplet.');
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

  private restoreValidationState(): void {
    if (this.isCheckpointValidated()) {
      this.validationMessage.set(
        this.mode() === 'expediteur' ? 'Retrait deja valide.' : 'Depot deja valide.',
      );
    }
  }

  private prepareBarcodeDetector(): void {
    const detectorConstructor = (
      window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!detectorConstructor) {
      this.cameraError.set(
        'Camera activee. Si le QR nest pas detecte automatiquement, saisissez le numero de colis affiche sous le QR code.',
      );
      return;
    }

    this.barcodeDetector = new detectorConstructor({ formats: ['qr_code'] });
  }

  private startCameraLoop(): void {
    if (this.cameraScanIntervalId) {
      window.clearInterval(this.cameraScanIntervalId);
    }

    this.cameraScanIntervalId = window.setInterval(() => {
      void this.detectQrFromCamera();
    }, 600);
  }

  private async detectQrFromCamera(): Promise<void> {
    if (!this.barcodeDetector || !this.cameraVideo || this.cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    try {
      const results = await this.barcodeDetector.detect(this.cameraVideo);
      const rawValue = results.find((result) => !!result.rawValue)?.rawValue?.trim();
      if (!rawValue || rawValue === this.scannedPayload().trim()) return;
      this.scannedPayload.set(rawValue);
      this.validateScannedQr();
    } catch {
      this.cameraError.set('Lecture du QR code impossible pour le moment. Rapprochez le code de la camera.');
    }
  }

  private async openCameraStream(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let lastError: unknown;
    for (const constraint of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraint);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private canUseCameraInCurrentContext(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.isSecureContext) return true;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  private cameraActivationErrorMessage(error: unknown): string {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return "Acces camera refuse. Autorisez la camera dans le navigateur puis reessayez.";
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return "Aucune camera n'a ete detectee sur cet appareil. Saisissez le numero de colis manuellement.";
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return "La camera est deja utilisee par une autre application. Fermez-la puis reessayez.";
    }
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return "La camera disponible ne correspond pas aux reglages demandes. Reessayez ou saisissez le numero de colis.";
    }
    return "Impossible d'activer la camera. Autorisez l'acces camera ou saisissez le numero de colis manuellement.";
  }

  private validateManualParcelReference(rawReference: string): void {
    const expectedReferences = [
      this.parcelNumber(),
      ...this.manifest().parcels.map((parcel) => parcel.number),
    ]
      .map((reference) => this.normalizeParcelReference(reference))
      .filter(Boolean);
    const submittedReference = this.normalizeParcelReference(rawReference);

    if (
      !submittedReference ||
      !expectedReferences.some((reference) => reference === submittedReference)
    ) {
      this.validationError.set('Numero de colis invalide pour cette reservation.');
      return;
    }

    const key = this.validationStorageKey();
    if (key) {
      globalThis.localStorage?.setItem(key, 'validated');
    }
    this.stopCamera();
    this.validationMessage.set(
      this.mode() === 'expediteur'
        ? 'Retrait confirme. Le numero de colis correspond a cette reservation.'
        : 'Depot confirme. Le numero de colis correspond a cette reservation.',
    );
    this.validationError.set(null);
  }

  private normalizeParcelReference(value: string): string {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private parseParcelManifest(notes: string | null): ParcelManifest {
    const pickup = this.extractContact(notes, 'Expediteur');
    const dropoff = this.extractContact(notes, 'Destinataire');
    return {
      deliveryType: this.extractNamedValue(notes, 'Type de livraison') ?? '',
      pickupName: pickup.name,
      pickupPhone: pickup.phone,
      pickupAddress: this.extractNamedValue(notes, 'Depart colis') ?? '',
      dropoffName: dropoff.name,
      dropoffPhone: dropoff.phone,
      dropoffAddress: this.extractNamedValue(notes, 'Arrivee destinataire') ?? '',
      parcels: this.extractParcels(notes),
      note: this.extractNamedValue(notes, 'Note livraison') ?? '',
    };
  }

  private extractContact(notes: string | null, key: string): { name: string; phone: string } {
    const value = this.extractNamedValue(notes, key) ?? '';
    const [name = '', phone = ''] = value.split(/\s+-\s+/);
    return {
      name: name.trim(),
      phone: phone.trim(),
    };
  }

  private extractNamedValue(notes: string | null, key: string): string | null {
    if (!notes) return null;
    const pattern = new RegExp(`${key}\\s*[:=-]\\s*([^\\n;]+)`, 'i');
    const match = notes.match(pattern);
    return match?.[1]?.trim().replace(/\.$/, '').trim() || null;
  }

  private extractParcels(notes: string | null): ParcelLine[] {
    if (!notes) return [];
    const parcels: ParcelLine[] = [];
    const regex = /Colis\s+(\d+)\s*\(([A-Z0-9-]+)\)\s*:\s*([^\.]+)\./gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(notes)) !== null) {
      parcels.push({
        index: Number(match[1]),
        number: match[2].trim().toUpperCase(),
        description: match[3].trim(),
      });
    }

    return parcels;
  }

  private payloadChecksum(value: unknown): number {
    return this.checksum(JSON.stringify(value));
  }

  private checksum(value: string): number {
    return value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 99991, 17);
  }
}
