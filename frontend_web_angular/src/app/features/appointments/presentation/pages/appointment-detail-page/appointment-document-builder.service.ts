import { Injectable } from '@angular/core';
import { AppointmentView, MedicalPrescriptionPayload } from '../../../domain/appointments.models';
import { buildPersonalizedMedicalPrescription } from './medical-prescription-document-template';

export type MedicalPrescriptionItem = { text: string };

@Injectable({ providedIn: 'root' })
export class AppointmentDocumentBuilderService {
  buildMedicalPrescriptionHtml(
    appointment: AppointmentView,
    prescription: MedicalPrescriptionPayload,
  ): string {
    return buildPersonalizedMedicalPrescription(
      appointment, appointment.prescriptionTemplate, this.medicalPrescriptionItems(prescription),
    );
  }

  medicalPrescriptionItems(prescription: MedicalPrescriptionPayload): MedicalPrescriptionItem[] {
    return [...prescription.treatments, ...prescription.vaccines, ...prescription.acts]
      .map(text => ({ text }));
  }
}
