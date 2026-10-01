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
import { DocumentImageInputComponent } from '../../../../../shared/ui/document-image-input/document-image-input.component';

type ImageField = 'logoUrl' | 'signatureUrl' | 'cachetUrl';

@Component({
  selector: 'app-prescription-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentImageInputComponent],
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

  protected upload(file: File, field: ImageField): void {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.feedback.error('Choisissez une image PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.feedback.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    this.uploading = field;
    this.service
      .uploadProfessionalAsset(file)
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

  protected removeImage(field: ImageField): void {
    this.template[field] = '';
  }

  protected showImageError(message: string): void {
    this.feedback.error(message);
  }

  protected imageUrl(field: ImageField): string | null {
    return publicAssetUrl(this.template[field]);
  }
}
