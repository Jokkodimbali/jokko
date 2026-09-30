import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { asyncScheduler, finalize, observeOn } from 'rxjs';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { publicAssetUrl } from '../../../../../shared/utils/public-asset-url';
import {
  EMPTY_MEDICAL_PRESCRIPTION_TEMPLATE,
  MedicalPrescriptionTemplate,
} from '../../../../appointments/domain/medical-prescription-template';
import { DoctorSpaceService } from '../../../data-access/doctor-space.service';

type ImageField = 'logoUrl' | 'signatureUrl' | 'cachetUrl';

@Component({
  selector: 'app-prescription-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prescription-template-editor.component.html',
  styleUrl: './prescription-template-editor.component.scss',
})
export class PrescriptionTemplateEditorComponent implements OnInit {
  @Input() doctorName = '';
  @Input() doctorPhone = '';
  @Input() doctorAddress = '';
  @Input() doctorQualification = '';

  private readonly service = inject(DoctorSpaceService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected template: MedicalPrescriptionTemplate = { ...EMPTY_MEDICAL_PRESCRIPTION_TEMPLATE };
  protected loading = true;
  protected saving = false;
  protected uploading: ImageField | null = null;
  protected readonly filterImages: Record<ImageField, boolean> = {
    logoUrl: false,
    signatureUrl: false,
    cachetUrl: false,
  };
  protected readonly today = new Date();

  ngOnInit(): void {
    this.template = {
      ...EMPTY_MEDICAL_PRESCRIPTION_TEMPLATE,
      prescripteur: this.doctorName,
      telephone: this.doctorPhone,
      adresse: this.doctorAddress,
      qualification: this.doctorQualification,
    };
    this.service
      .getMyPrescriptionTemplate()
      .pipe(observeOn(asyncScheduler))
      .subscribe({
        next: (template) => {
          this.template = { ...this.template, ...template };
          this.loading = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          this.loading = false;
          this.changeDetector.markForCheck();
          this.feedback.error(
            getHttpErrorMessage(error, "Impossible de charger le modèle d'ordonnance."),
          );
        },
      });
  }

  protected save(): void {
    if (this.loading || this.saving || this.uploading) return;
    this.saving = true;
    this.service
      .updateMyPrescriptionTemplate(this.template)
      .pipe(
        observeOn(asyncScheduler),
        finalize(() => {
          this.saving = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (template) => {
          this.template = { ...EMPTY_MEDICAL_PRESCRIPTION_TEMPLATE, ...template };
          this.changeDetector.markForCheck();
          this.feedback.success("Modèle d'ordonnance enregistré.");
        },
        error: (error) =>
          this.feedback.error(
            getHttpErrorMessage(error, "Enregistrement de l'ordonnance impossible."),
          ),
      });
  }

  protected async upload(event: Event, field: ImageField): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.feedback.error('Choisissez une image PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.feedback.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    this.uploading = field;
    let image = file;
    try {
      if (this.filterImages[field]) image = await this.removeLightBackground(file);
    } catch {
      this.feedback.error("Impossible de nettoyer l'image. Importation de l'original.");
    }
    this.service
      .uploadProfessionalAsset(image)
      .pipe(
        observeOn(asyncScheduler),
        finalize(() => {
          this.uploading = null;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (asset) => {
          this.template[field] = publicAssetUrl(asset.fileUrl) ?? asset.fileUrl;
          this.changeDetector.markForCheck();
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, "Importation de l'image impossible.")),
      });
  }

  private async removeLightBackground(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < image.data.length; index += 4) {
        const lightness = (image.data[index] + image.data[index + 1] + image.data[index + 2]) / 3;
        if (lightness > 220) {
          image.data[index + 3] = Math.round(
            image.data[index + 3] * Math.max(0, (255 - lightness) / 35),
          );
        }
      }
      context.putImageData(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      return blob
        ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' })
        : file;
    } finally {
      bitmap.close();
    }
  }

  protected imageFilterEnabled(field: string): boolean {
    return this.filterImages[field as ImageField] ?? false;
  }

  protected setImageFilter(field: string, enabled: boolean): void {
    if (field in this.filterImages) this.filterImages[field as ImageField] = enabled;
  }

  protected removeImage(field: ImageField): void {
    this.template[field] = '';
  }

  protected imageUrl(field: ImageField): string | null {
    return publicAssetUrl(this.template[field]);
  }
}
