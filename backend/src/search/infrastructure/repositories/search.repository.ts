import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  SearchProfessionalPortfolioImageView,
  SearchProfessionalServiceView,
  SearchProfessionalView,
  SearchProfessionalsInput,
  SearchProfessionalsResult,
  SearchRepositoryPort,
} from '../../application/ports/search-repository.port';

type SearchProfessionalRow = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  bio: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: Prisma.Decimal | number | string;
  totalReviews: number;
  distanceKm: number | null;
  hasServices: boolean;
};

@Injectable()
export class SearchRepository implements SearchRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async searchProfessionals(
    input: SearchProfessionalsInput,
  ): Promise<SearchProfessionalsResult> {
    const page = input.page;
    const limit = input.limit;
    const offset = (page - 1) * limit;
    const radiusKm = input.radiusKm ?? 25;
    const hasGeo =
      input.latitude !== undefined && input.longitude !== undefined;

    const queryText = input.query?.trim();
    const city = input.city?.trim();
    const role = input.role ?? 'PRESTATAIRE';

    const geoDistanceFragment = hasGeo
      ? Prisma.sql`
          (
            6371.0 * acos(
              least(
                1.0,
                greatest(
                  -1.0,
                  cos(radians(${input.latitude}))
                  * cos(radians(ST_Y(pp.localisation::geometry)))
                  * cos(radians(ST_X(pp.localisation::geometry)) - radians(${input.longitude}))
                  + sin(radians(${input.latitude}))
                  * sin(radians(ST_Y(pp.localisation::geometry)))
                )
              )
            )
          )
        `
      : Prisma.sql`NULL`;

    const queryFilter = queryText
      ? Prisma.sql`
          AND (
            u.name ILIKE ${`%${queryText}%`}
            OR pp.company_name ILIKE ${`%${queryText}%`}
            OR pp.bio ILIKE ${`%${queryText}%`}
            OR pp.city ILIKE ${`%${queryText}%`}
            OR EXISTS (
              SELECT 1
              FROM services s2
              INNER JOIN categories c2 ON c2.id = s2.category_id
              WHERE s2.professional_id = pp.id
                AND s2.is_available = true
                AND (
                  s2.name ILIKE ${`%${queryText}%`}
                  OR s2.description ILIKE ${`%${queryText}%`}
                  OR c2.name ILIKE ${`%${queryText}%`}
                )
            )
            OR EXISTS (
              SELECT 1
              FROM professional_specialties ps2
              INNER JOIN categories c3 ON c3.id = ps2.category_id
              LEFT JOIN service_subcategories sc2 ON sc2.id = ps2.subcategory_id
              WHERE ps2.professional_id = pp.id
                AND (
                  c3.name ILIKE ${`%${queryText}%`}
                  OR sc2.name ILIKE ${`%${queryText}%`}
                  OR sc2.description ILIKE ${`%${queryText}%`}
                )
            )
          )
        `
      : Prisma.empty;

    const cityFilter = city
      ? Prisma.sql`AND pp.city ILIKE ${city}`
      : Prisma.empty;

    const categoryFilter = input.categoryId
      ? Prisma.sql`
          AND (
            EXISTS (
              SELECT 1
              FROM services s3
              WHERE s3.professional_id = pp.id
                AND s3.category_id = ${input.categoryId}::uuid
                AND s3.is_available = true
            )
            OR EXISTS (
              SELECT 1
              FROM professional_specialties ps3
              WHERE ps3.professional_id = pp.id
                AND ps3.category_id = ${input.categoryId}::uuid
            )
          )
        `
      : Prisma.empty;

    const subCategoryFilter = input.subCategoryId
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM professional_specialties ps4
            WHERE ps4.professional_id = pp.id
              AND ps4.subcategory_id = ${input.subCategoryId}::uuid
              ${input.categoryId ? Prisma.sql`AND ps4.category_id = ${input.categoryId}::uuid` : Prisma.empty}
          )
        `
      : Prisma.empty;

    const geoFilter = hasGeo
      ? Prisma.sql`
          AND pp.localisation IS NOT NULL
          AND (
            6371.0 * acos(
              least(
                1.0,
                greatest(
                  -1.0,
                  cos(radians(${input.latitude}))
                  * cos(radians(ST_Y(pp.localisation::geometry)))
                  * cos(radians(ST_X(pp.localisation::geometry)) - radians(${input.longitude}))
                  + sin(radians(${input.latitude}))
                  * sin(radians(ST_Y(pp.localisation::geometry)))
                )
              )
            )
          ) <= ${radiusKm}
        `
      : Prisma.empty;

    const orderBy = hasGeo
      ? Prisma.sql`"distanceKm" ASC NULLS LAST, "hasServices" DESC, pp.global_rating DESC, pp.total_reviews DESC, pp.id DESC`
      : Prisma.sql`"hasServices" DESC, pp.global_rating DESC, pp.total_reviews DESC, pp.id DESC`;

    const visibilityFilter =
      role === 'MEDECIN'
        ? Prisma.sql`
            AND u.role = 'MEDECIN'
            AND pp.kyc_status = 'VERIFIE'
          `
        : Prisma.sql`
            AND u.role = 'PRESTATAIRE'
            AND pp.kyc_status = 'VERIFIE'
            AND (
              EXISTS (
                SELECT 1
                FROM services s
                WHERE s.professional_id = pp.id
                  AND s.is_available = true
              )
              OR EXISTS (
                SELECT 1
                FROM professional_specialties ps
                WHERE ps.professional_id = pp.id
              )
            )
          `;

    const baseQuery = Prisma.sql`
      FROM professional_profiles pp
      INNER JOIN users u ON u.id = pp.user_id
      WHERE u.is_active = true
        ${visibilityFilter}
        ${cityFilter}
        ${categoryFilter}
        ${subCategoryFilter}
        ${queryFilter}
        ${geoFilter}
    `;

    const rows = await this.prisma.$queryRaw<
      SearchProfessionalRow[]
    >(Prisma.sql`
      SELECT
        pp.id AS id,
        u.id AS "userId",
        u.name AS name,
        u.avatar_url AS "avatarUrl",
        pp.company_name AS "companyName",
        pp.bio AS bio,
        pp.city AS city,
        CASE
          WHEN pp.localisation IS NULL THEN NULL
          ELSE ST_Y(pp.localisation::geometry)
        END AS latitude,
        CASE
          WHEN pp.localisation IS NULL THEN NULL
          ELSE ST_X(pp.localisation::geometry)
        END AS longitude,
        pp.global_rating AS rating,
        pp.total_reviews AS "totalReviews",
        ${geoDistanceFragment} AS "distanceKm",
        EXISTS (
          SELECT 1
          FROM services s_rank
          WHERE s_rank.professional_id = pp.id
            AND s_rank.is_available = true
            ${
              input.categoryId
                ? Prisma.sql`AND s_rank.category_id = ${input.categoryId}::uuid`
                : Prisma.empty
            }
        ) AS "hasServices"
      ${baseQuery}
      ORDER BY ${orderBy}
      OFFSET ${offset}
      LIMIT ${limit}
    `);

    const totals = await this.prisma.$queryRaw<
      Array<{ total: bigint | number }>
    >(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        ${baseQuery}
      `,
    );

    const profileIds = rows.map((row) => row.id);
    const services = profileIds.length
      ? await this.prisma.service.findMany({
          where: {
            profilProfessionnelId: { in: profileIds },
            estDisponible: true,
            ...(input.categoryId ? { categorieId: input.categoryId } : {}),
          },
          orderBy: [{ creeLe: 'desc' }],
          select: {
            id: true,
            nom: true,
            prix: true,
            typePrix: true,
            modeDeplacement: true,
            profilProfessionnelId: true,
            categorieId: true,
            categorie: {
              select: {
                nom: true,
              },
            },
          },
        })
      : [];

    const servicesByProfile = new Map<
      string,
      SearchProfessionalServiceView[]
    >();
    for (const service of services) {
      const mappedService: SearchProfessionalServiceView = {
        id: service.id,
        name: service.nom,
        price: Number(service.prix),
        priceType: service.typePrix,
        travelMode: service.modeDeplacement,
        categoryId: service.categorieId,
        categoryName: service.categorie.nom,
      };

      const existing =
        servicesByProfile.get(service.profilProfessionnelId) ?? [];
      existing.push(mappedService);
      servicesByProfile.set(service.profilProfessionnelId, existing);
    }

    const specialties = profileIds.length
      ? await this.prisma.specialiteProfessionnelle.findMany({
          where: {
            profilProfessionnelId: { in: profileIds },
            ...(input.categoryId ? { categorieId: input.categoryId } : {}),
            ...(input.subCategoryId
              ? { sousCategorieId: input.subCategoryId }
              : {}),
          },
          orderBy: [{ creeLe: 'desc' }],
          select: {
            id: true,
            profilProfessionnelId: true,
            categorieId: true,
            sousCategorieId: true,
            categorie: {
              select: {
                nom: true,
              },
            },
            sousCategorie: {
              select: {
                nom: true,
              },
            },
          },
        })
      : [];

    const specialtiesByProfile = new Map<
      string,
      SearchProfessionalServiceView[]
    >();
    for (const specialty of specialties) {
      const mappedSpecialty: SearchProfessionalServiceView = {
        id: specialty.id,
        name: specialty.sousCategorie?.nom ?? specialty.categorie.nom,
        price: 0,
        priceType: 'SPECIALTY',
        travelMode: 'PRESTATAIRE_SE_DEPLACE',
        categoryId: specialty.categorieId,
        categoryName: specialty.categorie.nom,
        subCategoryId: specialty.sousCategorieId,
        subCategoryName: specialty.sousCategorie?.nom ?? null,
      };

      const existing =
        specialtiesByProfile.get(specialty.profilProfessionnelId) ?? [];
      existing.push(mappedSpecialty);
      specialtiesByProfile.set(specialty.profilProfessionnelId, existing);
    }

    const portfolioItems = profileIds.length
      ? await this.prisma.elementPortfolio.findMany({
          where: {
            profilProfessionnelId: { in: profileIds },
          },
          orderBy: [{ creeLe: 'desc' }],
          select: {
            id: true,
            titre: true,
            urlImage: true,
            profilProfessionnelId: true,
          },
        })
      : [];

    const portfolioByProfile = new Map<
      string,
      SearchProfessionalPortfolioImageView[]
    >();
    for (const item of portfolioItems) {
      const existing = portfolioByProfile.get(item.profilProfessionnelId) ?? [];
      if (existing.length >= 2) {
        continue;
      }

      existing.push({
        id: item.id,
        title: item.titre,
        url: item.urlImage,
      });
      portfolioByProfile.set(item.profilProfessionnelId, existing);
    }

    const items: SearchProfessionalView[] = rows.map((row) => {
      const distance = row.distanceKm === null ? null : Number(row.distanceKm);

      return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        avatarUrl: row.avatarUrl,
        companyName: row.companyName,
        bio: row.bio,
        city: row.city,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        rating: Number(row.rating),
        totalReviews: row.totalReviews,
        distanceKm: distance === null ? null : Number(distance.toFixed(2)),
        services: servicesByProfile.get(row.id) ?? [],
        specialties: specialtiesByProfile.get(row.id) ?? [],
        portfolioImages: portfolioByProfile.get(row.id) ?? [],
      };
    });

    return {
      items,
      total: Number(totals[0]?.total ?? 0),
      page,
      limit,
    };
  }
}
