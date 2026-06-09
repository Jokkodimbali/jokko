export const CATEGORIES_REPOSITORY_PORT = Symbol('CATEGORIES_REPOSITORY_PORT');

export type CategoryView = {
  id: string;
  nom: string;
  urlIcone: string | null;
  ordreTri: number;
  tauxCommission: number;
  estActive: boolean;
};

export type CreateCategoryInput = {
  name: string;
  iconUrl: string | null;
  sortOrder: number;
  commissionRate: number;
};

export type UpdateCategoryInput = {
  categoryId: string;
  name: string;
  iconUrl: string | null;
  sortOrder: number;
  commissionRate: number;
};

export type CreateCategoryResult =
  | { status: 'created'; category: CategoryView }
  | { status: 'name_conflict' };

export type UpdateCategoryResult =
  | { status: 'updated'; category: CategoryView }
  | { status: 'not_found' }
  | { status: 'name_conflict' };

export type DisableCategoryResult =
  | { status: 'disabled'; category: CategoryView }
  | { status: 'not_found' };

export type ActivateCategoryResult =
  | { status: 'activated'; category: CategoryView }
  | { status: 'not_found' };

export interface CategoriesRepositoryPort {
  listActive(
    page?: number,
    limit?: number,
  ): Promise<{ items: CategoryView[]; total: number }>;
  findById(categoryId: string): Promise<CategoryView | null>;
  findByName(name: string): Promise<{ id: string } | null>;
  create(input: CreateCategoryInput): Promise<CreateCategoryResult>;
  update(input: UpdateCategoryInput): Promise<UpdateCategoryResult>;
  disable(categoryId: string): Promise<DisableCategoryResult>;
  activate(categoryId: string): Promise<ActivateCategoryResult>;
}
