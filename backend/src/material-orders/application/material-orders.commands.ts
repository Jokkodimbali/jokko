export type CreateMaterialOrderCommand = {
  reservationId: string;
  hardwareStoreId: string;
};

export type ValidateMaterialOrderCommand = {
  status: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';
  note?: string;
  items: Array<{
    position: number;
    name: string;
    isAvailable: boolean;
    unitPrice?: number;
  }>;
};
