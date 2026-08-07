import { Injectable } from '@angular/core';
import { MedicalPrescriptionPayload } from '../../../domain/appointments.models';

const PRESCRIPTION_BLOCK_PATTERN =
  /---JOKKO_MEDICAL_PRESCRIPTION---\s*([\s\S]*?)\s*---END_JOKKO_MEDICAL_PRESCRIPTION---/;

const PRESCRIPTION_BLOCK_REPLACEMENT_PATTERN =
  /\n?---JOKKO_MEDICAL_PRESCRIPTION---[\s\S]*?---END_JOKKO_MEDICAL_PRESCRIPTION---/g;

@Injectable({ providedIn: 'root' })
export class AppointmentMedicalPrescriptionService {
  hasContent(prescription: MedicalPrescriptionPayload | null | undefined): boolean {
    return (
      !!prescription &&
      (prescription.acts.length > 0 ||
        prescription.vaccines.length > 0 ||
        prescription.treatments.length > 0)
    );
  }

  extractFromNotes(notes: string | null | undefined): MedicalPrescriptionPayload | null {
    if (!notes) return null;

    const match = notes.match(PRESCRIPTION_BLOCK_PATTERN);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[1]) as Partial<MedicalPrescriptionPayload>;
      return {
        acts: this.normalizeItems(parsed.acts),
        vaccines: this.normalizeItems(parsed.vaccines),
        treatments: this.normalizeItems(parsed.treatments),
      };
    } catch {
      return null;
    }
  }

  stripFromNotes(notes: string | null | undefined): string {
    return (notes ?? '').replace(PRESCRIPTION_BLOCK_REPLACEMENT_PATTERN, '');
  }

  normalizeItems(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, index, items) => item.length >= 2 && items.indexOf(item) === index);
  }
}
