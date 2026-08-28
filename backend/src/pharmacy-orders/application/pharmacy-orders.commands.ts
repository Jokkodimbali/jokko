export type CreatePharmacyOrderCommand = {
  medicalReservationId: string;
  pharmacyId: string;
};

export type ValidatePharmacyOrderCommand = {
  status: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';
  pharmacyNote?: string;
  medicineItems?: Array<{
    position: number;
    name: string;
    isAvailable: boolean;
    price?: number;
  }>;
};
