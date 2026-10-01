import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { InvoiceDocumentService } from '../../../../../shared/documents/invoice-document.service';
import { buildInvoiceDocument, InvoiceDocument, InvoiceTemplate } from '../../../../../shared/documents/invoice-document';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { DocumentImageInputComponent } from '../../../../../shared/ui/document-image-input/document-image-input.component';

type ImageField = 'logoUrl' | 'signatureUrl' | 'stampUrl';

@Component({
  selector: 'app-admin-invoice-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentImageInputComponent],
  templateUrl: './admin-invoice-settings.component.html',
  styleUrl: './admin-invoice-settings.component.scss',
})
export class AdminInvoiceSettingsComponent {
  private readonly invoices = inject(InvoiceDocumentService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewHost = viewChild.required<ElementRef<HTMLElement>>('previewHost');

  protected readonly draft = signal<InvoiceTemplate | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal<ImageField | null>(null);
  protected readonly error = signal('');
  protected readonly previewScale = signal(0.6);
  protected readonly previewHeight = computed(() => 1123 * this.previewScale());
  protected readonly busy = computed(() => this.loading() || this.saving() || !!this.uploading());
  protected readonly imageFields: Array<{ key: ImageField; label: string; kind: 'logo' | 'signature' | 'stamp' }> = [
    { key: 'logoUrl', label: 'Logo', kind: 'logo' },
    { key: 'signatureUrl', label: 'Signature du système', kind: 'signature' },
    { key: 'stampUrl', label: 'Cachet du système', kind: 'stamp' },
  ];
  protected readonly preview = computed(() => {
    const template = this.draft();
    if (!template) return null;
    return this.sanitizer.bypassSecurityTrustHtml(buildInvoiceDocument(this.example(template)));
  });

  constructor() {
    afterNextRender(() => {
      const host = this.previewHost().nativeElement;
      const observer = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width || host.clientWidth;
        this.previewScale.set(Math.min(1, Math.max(0.1, width / 794)));
      });
      observer.observe(host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.draft.set(await firstValueFrom(this.invoices.loadTemplate()));
    } catch (error) {
      this.error.set(getHttpErrorMessage(error, 'Impossible de charger le modèle de facture.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected update<K extends keyof InvoiceTemplate>(key: K, value: InvoiceTemplate[K]): void {
    this.draft.update(current => current ? { ...current, [key]: value } : null);
  }

  protected async save(): Promise<void> {
    const template = this.draft();
    if (!template || this.busy() || !template.brandName.trim()) return;
    this.saving.set(true);
    try {
      this.draft.set(await firstValueFrom(this.invoices.saveTemplate(template)));
      this.feedback.success('Modèle enregistré. Il sera utilisé pour les factures de tous les prestataires.');
    } catch (error) {
      this.feedback.error(getHttpErrorMessage(error, 'Impossible d’enregistrer le modèle.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async upload(key: ImageField, file: File): Promise<void> {
    if (!file || this.busy()) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.feedback.error('Choisissez une image PNG, JPEG ou WebP de 5 Mo maximum.');
      return;
    }
    this.uploading.set(key);
    try {
      const result = await firstValueFrom(this.invoices.uploadImage(file));
      this.update(key, result.imageUrl);
    } catch (error) {
      this.feedback.error(getHttpErrorMessage(error, 'Impossible d’importer cette image.'));
    } finally {
      this.uploading.set(null);
    }
  }

  protected showImageError(message: string): void {
    this.feedback.error(message);
  }

  private example(template: InvoiceTemplate): InvoiceDocument {
    return {
      template, reference: 'APERÇU — EXEMPLE', issuedAt: '2026-10-01T10:00:00Z',
      serviceDate: '2026-10-01T10:00:00Z',
      provider: { name: 'Nom du prestataire', subtitle: 'Profession ou activité', phone: 'Téléphone du prestataire', address: 'Adresse du prestataire' },
      client: { name: 'Nom du client', phone: 'Téléphone du client', address: 'Adresse du client' },
      travelMode: 'PRESTATAIRE_SE_DEPLACE', location: 'Lieu de la prestation',
      items: [{ name: 'Service réservé — exemple', quantity: 1, amount: 10000 }],
      total: 10000, includedFees: 500, paymentStatus: 'SUCCES', paymentMethod: 'WAVE', durationMinutes: 60,
    };
  }
}
