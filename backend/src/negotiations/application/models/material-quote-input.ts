export interface CreateMaterialQuoteInput {
  designation: string;
  unitPrice: number;
  quantity: number;
  createdBy?: 'CLIENT' | 'PRESTATAIRE';
}
