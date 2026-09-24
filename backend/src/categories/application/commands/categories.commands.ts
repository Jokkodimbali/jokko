export type CreateCategoryCommand = {
  name: string;
  iconUrl?: string | null;
  sortOrder?: number;
  commissionRate?: number;
  priceType?: 'FIXE' | 'NEGOCIABLE';
  professionalSpaceType?:
    | 'PRESTATAIRE'
    | 'MEDECIN'
    | 'QUINCAILLERIE'
    | 'PHARMACIE';
};

export type UpdateCategoryCommand = {
  name?: string;
  iconUrl?: string | null;
  sortOrder?: number;
  commissionRate?: number;
  priceType?: 'FIXE' | 'NEGOCIABLE';
  professionalSpaceType?:
    | 'PRESTATAIRE'
    | 'MEDECIN'
    | 'QUINCAILLERIE'
    | 'PHARMACIE';
};
