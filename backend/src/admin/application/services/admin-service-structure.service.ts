import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCategoryDto } from '../../../categories/presentation/dto/create-category.dto';
import type { AssignServiceSubCategoriesDto } from '../../presentation/dto/assign-service-subcategories.dto';
import type { CreateServiceSubCategoryDto } from '../../presentation/dto/create-service-subcategory.dto';

type ServiceStructureCategory = Awaited<
  ReturnType<AdminServiceStructureService['findCategories']>
>[number];

type ServiceStructureOptionSource = ServiceStructureCategory['services'][number];

type ServiceOptionAccumulator = {
  id: string;
  label: string;
  description: string | null;
  offerCount: number;
  minPrice: number;
  maxPrice: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
};

type BulkImportResult<T> = {
  created: T[];
  skippedExisting: string[];
  totalRequested: number;
};

type ServiceSubCategoryView = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

@Injectable()
export class AdminServiceStructureService {
  constructor(private readonly prisma: PrismaService) {}

  async getStructure(requestUser: AuthUser) {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const categories = await this.findCategories();
    const nodes = categories.map((category) => this.mapCategory(category));

    return {
      generatedAt: new Date(),
      totals: {
        categories: nodes.length,
        activeCategories: nodes.filter((category) => category.isActive).length,
        subCategories: nodes.reduce(
          (sum, category) => sum + category.subCategories.length,
          0,
        ),
        declaredServices: nodes.reduce(
          (sum, category) => sum + category.declaredServices,
          0,
        ),
        availableServices: nodes.reduce(
          (sum, category) => sum + category.availableServices,
          0,
        ),
        requiredServices: nodes.reduce(
          (sum, category) => sum + category.requiredServices,
          0,
        ),
      },
      categories: nodes,
      availableSubCategories: await this.listAvailableSubCategories(),
    };
  }

  async bulkCreateCategories(
    requestUser: AuthUser,
    categories: CreateCategoryDto[],
  ) {
    this.assertAdmin(requestUser);

    const normalizedItems = this.uniqueByName(
      categories.map((category) => ({
        name: this.normalizeRequiredName(category.name),
        iconUrl: category.iconUrl?.trim() || null,
        sortOrder: category.sortOrder ?? 0,
        commissionRate: category.commissionRate ?? 10,
      })),
    );

    const result: BulkImportResult<{
      id: string;
      name: string;
      iconUrl: string | null;
      sortOrder: number;
      commissionRate: number;
      isActive: boolean;
    }> = {
      created: [],
      skippedExisting: [],
      totalRequested: categories.length,
    };

    for (const item of normalizedItems) {
      const existing = await this.prisma.categorie.findUnique({
        where: { nom: item.name },
        select: { nom: true },
      });

      if (existing) {
        result.skippedExisting.push(item.name);
        continue;
      }

      const created = await this.prisma.categorie.create({
        data: {
          nom: item.name,
          urlIcone: item.iconUrl,
          ordreTri: item.sortOrder,
          tauxCommission: new Prisma.Decimal(item.commissionRate),
        },
        select: this.categorySummarySelect(),
      });
      result.created.push(this.mapCategorySummary(created));
    }

    return result;
  }

  async createSubCategory(
    requestUser: AuthUser,
    input: CreateServiceSubCategoryDto,
  ) {
    this.assertAdmin(requestUser);

    const name = this.normalizeRequiredName(input.name);
    const existing = await this.prisma.sousCategorieService.findUnique({
      where: { nom: name },
    });

    if (existing) {
      return this.mapSubCategory(existing);
    }

    const created = await this.prisma.sousCategorieService.create({
      data: {
        nom: name,
        description: input.description?.trim() || null,
        ordreTri: input.sortOrder ?? 0,
      },
    });

    return this.mapSubCategory(created);
  }

  async bulkCreateSubCategories(
    requestUser: AuthUser,
    subCategories: CreateServiceSubCategoryDto[],
  ) {
    this.assertAdmin(requestUser);

    const result: BulkImportResult<ServiceSubCategoryView> = {
      created: [],
      skippedExisting: [],
      totalRequested: subCategories.length,
    };
    const normalizedItems = this.uniqueByName(
      subCategories.map((subCategory) => ({
        name: this.normalizeRequiredName(subCategory.name),
        description: subCategory.description?.trim() || null,
        sortOrder: subCategory.sortOrder ?? 0,
      })),
    );

    for (const item of normalizedItems) {
      const existing = await this.prisma.sousCategorieService.findUnique({
        where: { nom: item.name },
        select: { nom: true },
      });

      if (existing) {
        result.skippedExisting.push(item.name);
        continue;
      }

      const created = await this.prisma.sousCategorieService.create({
        data: {
          nom: item.name,
          description: item.description,
          ordreTri: item.sortOrder,
        },
      });
      result.created.push(this.mapSubCategory(created));
    }

    return result;
  }

  async assignSubCategories(
    requestUser: AuthUser,
    categoryId: string,
    input: AssignServiceSubCategoriesDto,
  ) {
    this.assertAdmin(requestUser);

    const category = await this.prisma.categorie.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    const uniqueIds = Array.from(new Set(input.subCategoryIds));
    const existingSubCategories =
      await this.prisma.sousCategorieService.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });

    if (existingSubCategories.length !== uniqueIds.length) {
      throw appHttpException('ADMIN_SERVICE_SUBCATEGORY_NOT_FOUND');
    }

    const assignedElsewhere = await this.prisma.categorieSousCategorie.findFirst(
      {
        where: {
          categorieId: { not: categoryId },
          sousCategorieId: { in: uniqueIds },
        },
        select: { id: true },
      },
    );

    if (assignedElsewhere) {
      throw appHttpException('ADMIN_SERVICE_SUBCATEGORY_ALREADY_ASSIGNED');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.categorieSousCategorie.deleteMany({
        where: { categorieId: categoryId },
      });

      if (uniqueIds.length === 0) {
        return;
      }

      await tx.categorieSousCategorie.createMany({
        data: uniqueIds.map((subCategoryId, index) => ({
          categorieId: categoryId,
          sousCategorieId: subCategoryId,
          ordreTri: index,
        })),
        skipDuplicates: true,
      });
    });

    const refreshed = await this.findCategoryById(categoryId);
    if (!refreshed) {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    return this.mapCategory(refreshed);
  }

  async deleteEmptyCategory(requestUser: AuthUser, categoryId: string) {
    this.assertAdmin(requestUser);

    const category = await this.prisma.categorie.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        services: { select: { id: true }, take: 1 },
        sousCategories: { select: { id: true }, take: 1 },
      },
    });

    if (!category) {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    if (category.services.length > 0 || category.sousCategories.length > 0) {
      throw appHttpException('ADMIN_SERVICE_CATEGORY_NOT_EMPTY');
    }

    await this.prisma.categorie.delete({ where: { id: categoryId } });
    return { id: categoryId };
  }

  async deleteUnusedSubCategory(requestUser: AuthUser, subCategoryId: string) {
    this.assertAdmin(requestUser);

    const subCategory = await this.prisma.sousCategorieService.findUnique({
      where: { id: subCategoryId },
      select: {
        id: true,
        categories: { select: { id: true }, take: 1 },
      },
    });

    if (!subCategory) {
      throw appHttpException('ADMIN_SERVICE_SUBCATEGORY_NOT_FOUND');
    }

    if (subCategory.categories.length > 0) {
      throw appHttpException('ADMIN_SERVICE_SUBCATEGORY_IN_USE');
    }

    await this.prisma.sousCategorieService.delete({
      where: { id: subCategoryId },
    });
    return { id: subCategoryId };
  }

  private findCategories() {
    return this.prisma.categorie.findMany({
      orderBy: [{ ordreTri: 'asc' }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        urlIcone: true,
        ordreTri: true,
        tauxCommission: true,
        estActive: true,
        services: {
          orderBy: [{ nom: 'asc' }, { creeLe: 'desc' }],
          select: {
            id: true,
            nom: true,
            description: true,
            prix: true,
            dureeMinutes: true,
            estDisponible: true,
            estObligatoire: true,
          },
        },
        sousCategories: {
          orderBy: [{ ordreTri: 'asc' }, { sousCategorie: { nom: 'asc' } }],
          select: {
            ordreTri: true,
            sousCategorie: {
              select: {
                id: true,
                nom: true,
                description: true,
                ordreTri: true,
                estActive: true,
              },
            },
          },
        },
      },
    });
  }

  private findCategoryById(categoryId: string) {
    return this.prisma.categorie.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        nom: true,
        urlIcone: true,
        ordreTri: true,
        tauxCommission: true,
        estActive: true,
        services: {
          orderBy: [{ nom: 'asc' }, { creeLe: 'desc' }],
          select: {
            id: true,
            nom: true,
            description: true,
            prix: true,
            dureeMinutes: true,
            estDisponible: true,
            estObligatoire: true,
          },
        },
        sousCategories: {
          orderBy: [{ ordreTri: 'asc' }, { sousCategorie: { nom: 'asc' } }],
          select: {
            ordreTri: true,
            sousCategorie: {
              select: {
                id: true,
                nom: true,
                description: true,
                ordreTri: true,
                estActive: true,
              },
            },
          },
        },
      },
    });
  }

  private mapCategory(category: ServiceStructureCategory) {
    const availableServices = category.services.filter(
      (service) => service.estDisponible,
    );
    const requiredServices = category.services.filter(
      (service) => service.estObligatoire,
    );
    const unavailableServices = category.services.filter(
      (service) => !service.estDisponible,
    );

    return {
      id: category.id,
      name: category.nom,
      iconUrl: category.urlIcone,
      sortOrder: category.ordreTri,
      commissionRate: Number(category.tauxCommission),
      isActive: category.estActive,
      declaredServices: category.services.length,
      availableServices: availableServices.length,
      requiredServices: requiredServices.length,
      subCategories: category.sousCategories.map((assignment) => ({
        id: assignment.sousCategorie.id,
        name: assignment.sousCategorie.nom,
        description: assignment.sousCategorie.description,
        sortOrder: assignment.ordreTri,
        isActive: assignment.sousCategorie.estActive,
      })),
      branches: [
        ...category.sousCategories.map((assignment) =>
          this.buildSubCategoryBranch(category.id, assignment),
        ),
        this.buildBranch(
          category.id,
          'available',
          'Services disponibles',
          availableServices,
        ),
        this.buildBranch(
          category.id,
          'required',
          'Motifs obligatoires',
          requiredServices,
        ),
        this.buildBranch(
          category.id,
          'unavailable',
          'Services indisponibles',
          unavailableServices,
        ),
      ].filter(
        (branch) =>
          branch.options.length > 0 || branch.id.includes('-subcategory-'),
      ),
    };
  }

  private buildSubCategoryBranch(
    categoryId: string,
    assignment: ServiceStructureCategory['sousCategories'][number],
  ) {
    return {
      id: `${categoryId}-subcategory-${assignment.sousCategorie.id}`,
      label: assignment.sousCategorie.nom,
      optionCount: 0,
      options: [],
    };
  }

  private buildBranch(
    categoryId: string,
    key: string,
    label: string,
    services: ServiceStructureOptionSource[],
  ) {
    const options = this.buildOptions(services);
    return {
      id: `${categoryId}-${key}`,
      label,
      optionCount: options.length,
      options,
    };
  }

  private buildOptions(services: ServiceStructureOptionSource[]) {
    const byName = new Map<string, ServiceOptionAccumulator>();

    for (const service of services) {
      const key = service.nom.trim().toLowerCase();
      const price = this.decimalToNumber(service.prix);
      const existing = byName.get(key);

      if (!existing) {
        byName.set(key, {
          id: service.id,
          label: service.nom,
          description: service.description || null,
          offerCount: 1,
          minPrice: price,
          maxPrice: price,
          minDurationMinutes: service.dureeMinutes,
          maxDurationMinutes: service.dureeMinutes,
        });
        continue;
      }

      existing.offerCount += 1;
      existing.minPrice = Math.min(existing.minPrice, price);
      existing.maxPrice = Math.max(existing.maxPrice, price);
      existing.minDurationMinutes = Math.min(
        existing.minDurationMinutes,
        service.dureeMinutes,
      );
      existing.maxDurationMinutes = Math.max(
        existing.maxDurationMinutes,
        service.dureeMinutes,
      );
    }

    return Array.from(byName.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'fr'),
    );
  }

  private decimalToNumber(value: Prisma.Decimal): number {
    return Number(value);
  }

  private async listAvailableSubCategories() {
    const subCategories = await this.prisma.sousCategorieService.findMany({
      where: { estActive: true, categories: { none: {} } },
      orderBy: [{ ordreTri: 'asc' }, { nom: 'asc' }],
    });

    return subCategories.map((subCategory) => this.mapSubCategory(subCategory));
  }

  private assertAdmin(requestUser: AuthUser): void {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }
  }

  private normalizeRequiredName(value: string): string {
    const name = value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }
    return name;
  }

  private uniqueByName<T extends { name: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private mapSubCategory(subCategory: {
    id: string;
    nom: string;
    description: string | null;
    ordreTri: number;
    estActive: boolean;
  }): ServiceSubCategoryView {
    return {
      id: subCategory.id,
      name: subCategory.nom,
      description: subCategory.description,
      sortOrder: subCategory.ordreTri,
      isActive: subCategory.estActive,
    };
  }

  private categorySummarySelect() {
    return {
      id: true,
      nom: true,
      urlIcone: true,
      ordreTri: true,
      tauxCommission: true,
      estActive: true,
    } satisfies Prisma.CategorieSelect;
  }

  private mapCategorySummary(category: {
    id: string;
    nom: string;
    urlIcone: string | null;
    ordreTri: number;
    tauxCommission: Prisma.Decimal;
    estActive: boolean;
  }) {
    return {
      id: category.id,
      name: category.nom,
      iconUrl: category.urlIcone,
      sortOrder: category.ordreTri,
      commissionRate: Number(category.tauxCommission),
      isActive: category.estActive,
    };
  }
}
