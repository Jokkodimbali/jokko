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
  tauxCommission: true,
  estActive: true,
} as const;

type RawCategory = {
  id: string;
  nom: string;
  urlIcone: string | null;
  ordreTri: number;
  tauxCommission: Prisma.Decimal;
  estActive: boolean;
};

@Injectable()
export class CategoriesRepository implements CategoriesRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: CategoryView[]; total: number }> {
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      this.prisma.categorie.findMany({
        where: { estActive: true },
        orderBy: [{ ordreTri: 'asc' }, { nom: 'asc' }],
        select: CATEGORY_SELECT,
        skip,
        take: limit,
      }),
      this.prisma.categorie.count({ where: { estActive: true } }),
    ]);

    return {
      items: categories.map((category) => this.mapCategory(category)),
      total,
    };
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
          tauxCommission: input.commissionRate,
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
          tauxCommission: input.commissionRate,
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
      tauxCommission: Number(category.tauxCommission),
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
