export type CreateCategoryCommand = {
  name: string;
  iconUrl?: string | null;
  sortOrder?: number;
  commissionRate?: number;
};

export type UpdateCategoryCommand = {
  name?: string;
  iconUrl?: string | null;
  sortOrder?: number;
  commissionRate?: number;
};
