import { Injectable } from '@nestjs/common';
import { Prisma, TypeEspaceProfessionnel, TypePrix } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CategoriesRepositoryPort,
  ActivateCategoryResult,
  CategoryWithSubCategoriesView,
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
  typePrix: true,
  typeEspace: true,
  estActive: true,
} as const;

type RawCategory = {
  id: string;
  nom: string;
  urlIcone: string | null;
  ordreTri: number;
  tauxCommission: Prisma.Decimal;
  typePrix: TypePrix;
  typeEspace: TypeEspaceProfessionnel;
  estActive: boolean;
};

@Injectable()
export class CategoriesRepository implements CategoriesRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(
    page: number = 1,
    limit: number = 100,
  ): Promise<{ items: CategoryView[]; total: number }> {
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      this.prisma.$queryRaw<RawCategory[]>(Prisma.sql`
        SELECT
          c.id,
          c.name AS nom,
          c.icon_url AS "urlIcone",
          c.sort_order AS "ordreTri",
          c.commission_rate AS "tauxCommission",
          c.price_type AS "typePrix",
          c.professional_space_type AS "typeEspace",
          c.is_active AS "estActive"
        FROM categories c
        LEFT JOIN services s
          ON s.category_id = c.id
          AND s.is_available = true
        LEFT JOIN professional_profiles service_pp
          ON service_pp.id = s.professional_id
          AND service_pp.kyc_status = 'VERIFIE'
        LEFT JOIN users service_u
          ON service_u.id = service_pp.user_id
          AND service_u.is_active = true
          AND service_u.role IN ('PRESTATAIRE', 'MEDECIN')
        LEFT JOIN professional_specialties ps
          ON ps.category_id = c.id
        LEFT JOIN professional_profiles specialty_pp
          ON specialty_pp.id = ps.professional_id
          AND specialty_pp.kyc_status = 'VERIFIE'
        LEFT JOIN users specialty_u
          ON specialty_u.id = specialty_pp.user_id
          AND specialty_u.is_active = true
          AND specialty_u.role IN ('PRESTATAIRE', 'MEDECIN')
        WHERE c.is_active = true
        GROUP BY c.id
        ORDER BY
          COUNT(DISTINCT service_u.id) DESC,
          COUNT(DISTINCT specialty_u.id) DESC,
          c.sort_order ASC,
          c.name ASC
        OFFSET ${skip}
        LIMIT ${limit}
      `),
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

  async listActiveWithSubCategories(): Promise<
    CategoryWithSubCategoriesView[]
  > {
    const categories = await this.prisma.categorie.findMany({
      where: { estActive: true },
      orderBy: [{ ordreTri: 'asc' }, { nom: 'asc' }],
      select: {
        ...CATEGORY_SELECT,
        sousCategories: {
          orderBy: [{ ordreTri: 'asc' }, { sousCategorie: { nom: 'asc' } }],
          where: { sousCategorie: { estActive: true } },
          select: {
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

    return categories.map((category) => ({
      ...this.mapCategory(category),
      subCategories: category.sousCategories.map((assignment) => ({
        id: assignment.sousCategorie.id,
        nom: assignment.sousCategorie.nom,
        description: assignment.sousCategorie.description,
        ordreTri: assignment.sousCategorie.ordreTri,
        estActive: assignment.sousCategorie.estActive,
      })),
    }));
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
          typePrix: input.priceType,
          typeEspace: input.professionalSpaceType,
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
      const category = await this.prisma.$transaction(async (tx) => {
        const updatedCategory = await tx.categorie.update({
          where: { id: input.categoryId },
          data: {
            nom: input.name,
            urlIcone: input.iconUrl,
            ordreTri: input.sortOrder,
            tauxCommission: input.commissionRate,
            typePrix: input.priceType,
            typeEspace: input.professionalSpaceType,
          },
          select: CATEGORY_SELECT,
        });

        // La catégorie est la source de vérité pour les données existantes.
        await tx.service.updateMany({
          where: { categorieId: input.categoryId },
          data: { typePrix: input.priceType },
        });
        await tx.sousCategorieService.updateMany({
          where: { categories: { some: { categorieId: input.categoryId } } },
          data: { typeEspace: input.professionalSpaceType },
        });

        const affectedProfiles = await tx.profilProfessionnel.findMany({
          where: {
            OR: [
              { services: { some: { categorieId: input.categoryId } } },
              { specialites: { some: { categorieId: input.categoryId } } },
            ],
          },
          select: {
            id: true,
            utilisateurId: true,
            services: {
              select: { categorie: { select: { typeEspace: true } } },
            },
            specialites: {
              select: { categorie: { select: { typeEspace: true } } },
            },
          },
        });

        for (const profile of affectedProfiles) {
          const spaces = new Set<TypeEspaceProfessionnel>([
            ...profile.services.map((service) => service.categorie.typeEspace),
            ...profile.specialites.map(
              (specialty) => specialty.categorie.typeEspace,
            ),
          ]);
          const isOnlyMedical =
            spaces.size === 1 && spaces.has(TypeEspaceProfessionnel.MEDECIN);

          await tx.profilProfessionnel.update({
            where: { id: profile.id },
            data: {
              estPharmacie: spaces.has(TypeEspaceProfessionnel.PHARMACIE),
              estQuincaillerie: spaces.has(
                TypeEspaceProfessionnel.QUINCAILLERIE,
              ),
            },
          });
          await tx.utilisateur.update({
            where: { id: profile.utilisateurId },
            data: { role: isOnlyMedical ? 'MEDECIN' : 'PRESTATAIRE' },
          });
        }

        return updatedCategory;
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

  async activate(categoryId: string): Promise<ActivateCategoryResult> {
    try {
      const category = await this.prisma.categorie.update({
        where: { id: categoryId },
        data: { estActive: true },
        select: CATEGORY_SELECT,
      });

      return { status: 'activated', category: this.mapCategory(category) };
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
      typePrix: category.typePrix,
      typeEspace: category.typeEspace,
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
