export type CreateCategoryCommand = {
  name: string;
  iconUrl?: string | null;
  sortOrder?: number;
};

export type UpdateCategoryCommand = {
  name?: string;
  iconUrl?: string | null;
  sortOrder?: number;
};
