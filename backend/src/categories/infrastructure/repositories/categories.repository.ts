import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CategoriesRepositoryPort,
  CategoryView,
  CreateCategoryInput,
  CreateCategoryResult,
  DisableCategoryResult,
  UpdateCategoryInput,
  UpdateCategoryResult,
} from '../../application/ports/categories-repository.port';

const CATEGORY_SELECT = {
  id: true,
  nom: true,
  urlIcone: true,
  ordreTri: true,
  estActive: true,
} as const;

type RawCategory = {
  id: string;
  nom: string;
  urlIcone: string | null;
  ordreTri: number;
  estActive: boolean;
};

@Injectable()
export class CategoriesRepository implements CategoriesRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<CategoryView[]> {
    const categories = await this.prisma.categorie.findMany({
      where: { estActive: true },
      orderBy: [{ ordreTri: 'asc' }, { nom: 'asc' }],
      select: CATEGORY_SELECT,
    });

    return categories.map((category) => this.mapCategory(category));
  }

  async findById(categoryId: string): Promise<CategoryView | null> {
    const category = await this.prisma.categorie.findUnique({
      where: { id: categoryId },
      select: CATEGORY_SELECT,
    });

    return category ? this.mapCategory(category) : null;
  }

  async findByName(name: string): Promise<{ id: string } | null> {
    return this.prisma.categorie.findFirst({
      where: {
        nom: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
  }

  async create(input: CreateCategoryInput): Promise<CreateCategoryResult> {
    try {
      const category = await this.prisma.categorie.create({
        data: {
          nom: input.name,
          urlIcone: input.iconUrl,
          ordreTri: input.sortOrder,
        },
        select: CATEGORY_SELECT,
      });

      return { status: 'created', category: this.mapCategory(category) };
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        return { status: 'name_conflict' };
      }
      throw error;
    }
  }

  async update(input: UpdateCategoryInput): Promise<UpdateCategoryResult> {
    try {
      const category = await this.prisma.categorie.update({
        where: { id: input.categoryId },
        data: {
          nom: input.name,
          urlIcone: input.iconUrl,
          ordreTri: input.sortOrder,
        },
        select: CATEGORY_SELECT,
      });

      return { status: 'updated', category: this.mapCategory(category) };
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        return { status: 'not_found' };
      }

      if (this.isPrismaError(error, 'P2002')) {
        return { status: 'name_conflict' };
      }

      throw error;
    }
  }

  async disable(categoryId: string): Promise<DisableCategoryResult> {
    try {
      const category = await this.prisma.categorie.update({
        where: { id: categoryId },
        data: { estActive: false },
        select: CATEGORY_SELECT,
      });

      return { status: 'disabled', category: this.mapCategory(category) };
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        return { status: 'not_found' };
      }

      throw error;
    }
  }

  private mapCategory(category: RawCategory): CategoryView {
    return {
      id: category.id,
      nom: category.nom,
      urlIcone: category.urlIcone,
      ordreTri: category.ordreTri,
      estActive: category.estActive,
    };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }
}
