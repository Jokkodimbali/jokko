export type RegisterCommand = {
  phoneNumber: string;
  name: string;
  email?: string;
  password: string;
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN';
  adresse: string;
  medicalSpecialty?: string;
  medicalExpertises?: string[];
  medicalDocumentNames?: string[];
  categoryIds?: string[];
  subCategoryIds?: string[];
};

export type LoginCommand = {
  identifier?: string;
  phoneNumber?: string;
  password: string;
};
