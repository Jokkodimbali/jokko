export type CreatePharmacyOrderCommand = {
  medicalReservationId: string;
  pharmacyId: string;
};

export type ValidatePharmacyOrderCommand = {
  status: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';
  medicineAmount?: number;
  pharmacyNote?: string;
  unavailableItems?: string[];
};
