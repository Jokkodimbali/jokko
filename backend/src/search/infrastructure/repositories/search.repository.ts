import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
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
          ST_Distance(
            pp.localisation,
            ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
          ) / 1000.0
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
          )
        `
      : Prisma.empty;

    const cityFilter = city
      ? Prisma.sql`AND pp.city ILIKE ${city}`
      : Prisma.empty;

    const categoryFilter = input.categoryId
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM services s3
            WHERE s3.professional_id = pp.id
              AND s3.category_id = ${input.categoryId}::uuid
              AND s3.is_available = true
          )
        `
      : Prisma.empty;

    const geoFilter = hasGeo
      ? Prisma.sql`
          AND pp.localisation IS NOT NULL
          AND ST_DWithin(
            pp.localisation,
            ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
            ${radiusKm * 1000}
          )
        `
      : Prisma.empty;

    const orderBy = hasGeo
      ? Prisma.sql`"distanceKm" ASC NULLS LAST, pp.global_rating DESC, pp.total_reviews DESC, pp.id DESC`
      : Prisma.sql`pp.global_rating DESC, pp.total_reviews DESC, pp.id DESC`;

    const visibilityFilter =
      role === 'MEDECIN'
        ? Prisma.sql`
            AND u.role = 'MEDECIN'
            AND pp.kyc_status = 'VERIFIE'
          `
        : Prisma.sql`
            AND u.role = 'PRESTATAIRE'
            AND pp.kyc_status = 'VERIFIE'
            AND EXISTS (
              SELECT 1
              FROM services s
              WHERE s.professional_id = pp.id
                AND s.is_available = true
            )
          `;

    const baseQuery = Prisma.sql`
      FROM professional_profiles pp
      INNER JOIN users u ON u.id = pp.user_id
      WHERE u.is_active = true
        ${visibilityFilter}
        ${cityFilter}
        ${categoryFilter}
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
        ${geoDistanceFragment} AS "distanceKm"
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
        categoryId: service.categorieId,
        categoryName: service.categorie.nom,
      };

      const existing =
        servicesByProfile.get(service.profilProfessionnelId) ?? [];
      existing.push(mappedService);
      servicesByProfile.set(service.profilProfessionnelId, existing);
    }

    const items: SearchProfessionalView[] = rows.map((row) => ({
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
      distanceKm:
        row.distanceKm === null ? null : Number(row.distanceKm.toFixed(2)),
      services: servicesByProfile.get(row.id) ?? [],
    }));

    return {
      items,
      total: Number(totals[0]?.total ?? 0),
      page,
      limit,
    };
  }
}
