import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { captureDocumentImage, DocumentImageKind, documentImageSize, prepareDocumentImage, validateDocumentImage } from './document-image-processing';

@Component({
  selector: 'app-document-image-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-image-input.component.html',
  styleUrl: './document-image-input.component.scss',
})
export class DocumentImageInputComponent implements OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  @Input({ required: true }) label = '';
  @Input({ required: true }) kind: DocumentImageKind = 'logo';
  @Input() imageUrl = '';
  @Input() busy = false;
  @Output() imageSelected = new EventEmitter<File>();
  @Output() imageRemoved = new EventEmitter<void>();
  @Output() imageError = new EventEmitter<string>();
  @ViewChild('cameraVideo') private cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraGuide') private cameraGuide?: ElementRef<HTMLElement>;

  protected sourceFile: File | null = null;
  protected cameraOpen = false;
  protected cameraReady = false;
  protected processing = false;
  protected previewUrl = '';
  private stream: MediaStream | null = null;
  private cameraRequest = 0;

  protected get ratio(): string {
    const size = documentImageSize(this.kind);
    return `${size.width} / ${size.height}`;
  }

  protected async importImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy || this.processing) return;
    try {
      validateDocumentImage(file);
      this.setSource(file);
      await this.process(file, false);
    } catch (error) {
      this.imageError.emit(this.message(error));
    }
  }

  protected async filterImage(): Promise<void> {
    if (this.busy || this.processing || (!this.sourceFile && !this.imageUrl)) return;
    try {
      let file = this.sourceFile;
      if (!file) {
        const response = await fetch(this.imageUrl, { mode: 'cors' });
        if (!response.ok) throw new Error("Impossible de récupérer cette image. Réimportez l'original pour la filtrer.");
        const blob = await response.blob();
        file = new File([blob], 'image-originale.png', { type: blob.type });
        validateDocumentImage(file);
        this.setSource(file);
      }
      await this.process(file, true);
    } catch (error) {
      this.imageError.emit(this.message(error));
    }
  }

  protected async openCamera(): Promise<void> {
    if (this.busy || this.processing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.imageError.emit('Caméra indisponible. Utilisez HTTPS ou localhost et autorisez l’accès à la caméra.');
      return;
    }
    this.cameraOpen = true;
    this.cameraReady = false;
    const request = ++this.cameraRequest;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (request !== this.cameraRequest || !this.cameraOpen) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      // The overlay video is rendered after cameraOpen changes.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const video = this.cameraVideo?.nativeElement;
      if (!video) throw new Error('Impossible de démarrer la caméra.');
      video.srcObject = stream;
      await video.play();
      this.cameraReady = true;
      this.changeDetector.markForCheck();
    } catch (error) {
      this.closeCamera();
      this.imageError.emit(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé. Autorisez la caméra dans votre navigateur.'
        : this.message(error));
    }
  }

  protected async takePhoto(): Promise<void> {
    const video = this.cameraVideo?.nativeElement;
    if (!video || !this.cameraReady || this.processing) return;
    try {
      const file = await captureDocumentImage(video, this.kind, this.cameraGuide?.nativeElement.getBoundingClientRect());
      this.closeCamera();
      this.setSource(file);
      await this.process(file, false);
    } catch (error) {
      this.imageError.emit(this.message(error));
    }
  }

  protected closeCamera(): void {
    this.cameraRequest++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.cameraOpen = false;
    this.cameraReady = false;
    this.changeDetector.markForCheck();
  }

  protected remove(): void {
    this.sourceFile = null;
    this.clearPreview();
    this.imageRemoved.emit();
  }

  private async process(file: File, filter: boolean): Promise<void> {
    this.processing = true;
    try {
      const processed = await prepareDocumentImage(file, this.kind, filter);
      this.clearPreview();
      this.previewUrl = URL.createObjectURL(processed);
      this.imageSelected.emit(processed);
    } finally {
      this.processing = false;
      this.changeDetector.markForCheck();
    }
  }

  private setSource(file: File): void {
    this.sourceFile = file;
    this.clearPreview();
    this.previewUrl = URL.createObjectURL(file);
  }

  private clearPreview(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = '';
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : "Impossible de traiter l'image.";
  }

  ngOnDestroy(): void {
    this.closeCamera();
    this.clearPreview();
  }
}
