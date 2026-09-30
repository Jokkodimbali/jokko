export interface MedicalPrescriptionTemplate {
  tutelle: string;
  region: string;
  structure: string;
  prescripteur: string;
  qualification: string;
  adresse: string;
  telephone: string;
  piedDePage: string;
  logoUrl: string;
  signatureUrl: string;
  cachetUrl: string;
}

export const EMPTY_MEDICAL_PRESCRIPTION_TEMPLATE: MedicalPrescriptionTemplate = {
  tutelle: '',
  region: '',
  structure: '',
  prescripteur: '',
  qualification: '',
  adresse: '',
  telephone: '',
  piedDePage: 'Veuillez rapporter cette ordonnance à la prochaine consultation.',
  logoUrl: '',
  signatureUrl: '',
  cachetUrl: '',
};
