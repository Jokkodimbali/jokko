import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';

type RegionProviderRow = {
  id: string;
  ville: string | null;
  statutKyc: string;
  noteGlobale: { toNumber(): number };
  utilisateur: { estActif: boolean };
  services: Array<{
    id: string;
    estDisponible: boolean;
    categorie: { nom: string };
  }>;
  reservations: Array<{
    id: string;
    statut: string;
    litige: { id: string } | null;
  }>;
  paiements: Array<{
    montant: { toNumber(): number };
    montantNet: { toNumber(): number };
    statut: string;
  }>;
};

type RegionClientRow = {
  id: string;
  adresse: string | null;
};

type RegionAccumulator = {
  name: string;
  clients: number;
  providers: number;
  activeProviders: number;
  verifiedProviders: number;
  services: number;
  availableServices: number;
  reservations: number;
  completedReservations: number;
  activeReservations: number;
  disputes: number;
  grossRevenue: number;
  netRevenue: number;
  ratingSum: number;
  ratedProviders: number;
  categories: Map<string, number>;
};

type RegionTotals = {
  clients: number;
  regions: number;
  providers: number;
  activeProviders: number;
  verifiedProviders: number;
  services: number;
  availableServices: number;
  reservations: number;
  completedReservations: number;
  activeReservations: number;
  disputes: number;
  grossRevenue: number;
  netRevenue: number;
};

const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kedougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sedhiou',
  'Tambacounda',
  'Thies',
  'Ziguinchor',
] as const;

const REGION_ALIASES: Record<string, string[]> = {
  Dakar: [
    'dakar',
    'pikine',
    'guediawaye',
    'rufisque',
    'keur massar',
    'yoff',
    'ouakam',
    'parcelles',
    'plateau',
  ],
  Diourbel: ['diourbel', 'touba', 'mbacke', 'bambey'],
  Fatick: ['fatick', 'foundiougne', 'gossas', 'sokone'],
  Kaffrine: ['kaffrine', 'birkilane', 'koungheul', 'malem hodar'],
  Kaolack: ['kaolack', 'guinguineo', 'nioro', 'wack ngouna'],
  Kedougou: ['kedougou', 'salemata', 'saraya'],
  Kolda: ['kolda', 'velingara', 'medina yoro foula'],
  Louga: ['louga', 'kebemer', 'linguere', 'dahra'],
  Matam: ['matam', 'kanel', 'ranerou', 'ourossogui'],
  'Saint-Louis': [
    'saint louis',
    'saint-louis',
    'dagana',
    'podor',
    'richard toll',
  ],
  Sedhiou: ['sedhiou', 'bounkiling', 'goudomp'],
  Tambacounda: ['tambacounda', 'bakel', 'goudiry', 'koumpentoum'],
  Thies: ['thies', 'mbour', 'tivaouane', 'popenguine', 'joal'],
  Ziguinchor: ['ziguinchor', 'bignona', 'oussouye', 'cap skirring'],
};

@Injectable()
export class AdminRegionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRegions(requestUser: AuthUser) {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const [providers, clients] = await this.prisma.$transaction([
      this.prisma.profilProfessionnel.findMany({
        select: {
          id: true,
          ville: true,
          statutKyc: true,
          noteGlobale: true,
          utilisateur: { select: { estActif: true } },
          services: {
            select: {
              id: true,
              estDisponible: true,
              categorie: { select: { nom: true } },
            },
          },
          reservations: {
            select: {
              id: true,
              statut: true,
              litige: { select: { id: true } },
            },
          },
          paiements: {
            where: { statut: 'SUCCES' },
            select: {
              montant: true,
              montantNet: true,
              statut: true,
            },
          },
        },
        orderBy: { creeLe: 'desc' },
      }),
      this.prisma.utilisateur.findMany({
        where: { role: 'CLIENT' },
        select: {
          id: true,
          adresse: true,
        },
      }),
    ]);

    const regions = this.buildRegionRows(providers, clients);
    const totals = this.buildTotals(regions, clients.length);

    return {
      generatedAt: new Date(),
      totals,
      regions,
      topRegions: regions.slice(0, 5),
      coverage: {
        strongestRegion: regions[0]?.name ?? null,
        regionsWithRevenue: regions.filter((region) => region.grossRevenue > 0)
          .length,
        regionsWithDisputes: regions.filter((region) => region.disputes > 0)
          .length,
        verifiedCoverageRate: this.percentage(
          totals.verifiedProviders,
          totals.providers,
        ),
      },
    };
  }

  private buildRegionRows(
    providers: RegionProviderRow[],
    clients: RegionClientRow[],
  ) {
    const byRegion = new Map<string, RegionAccumulator>();

    for (const regionName of SENEGAL_REGIONS) {
      this.ensureRegion(byRegion, regionName);
    }

    for (const provider of providers) {
      const regionName = this.normalizeRegionName(provider.ville);
      const row = this.ensureRegion(byRegion, regionName);
      const rating = provider.noteGlobale.toNumber();

      row.providers += 1;
      row.activeProviders += provider.utilisateur.estActif ? 1 : 0;
      row.verifiedProviders += provider.statutKyc === 'VERIFIE' ? 1 : 0;
      row.services += provider.services.length;
      row.availableServices += provider.services.filter(
        (service) => service.estDisponible,
      ).length;
      row.reservations += provider.reservations.length;
      row.completedReservations += provider.reservations.filter(
        (reservation) => reservation.statut === 'TERMINEE',
      ).length;
      row.activeReservations += provider.reservations.filter((reservation) =>
        ['CONFIRMEE', 'PAYEE_SEQUESTRE', 'EN_COURS'].includes(
          reservation.statut,
        ),
      ).length;
      row.disputes += provider.reservations.filter(
        (reservation) => reservation.litige,
      ).length;
      row.grossRevenue += provider.paiements.reduce(
        (sum, payment) => sum + payment.montant.toNumber(),
        0,
      );
      row.netRevenue += provider.paiements.reduce(
        (sum, payment) => sum + payment.montantNet.toNumber(),
        0,
      );

      if (rating > 0) {
        row.ratingSum += rating;
        row.ratedProviders += 1;
      }

      for (const service of provider.services) {
        row.categories.set(
          service.categorie.nom,
          (row.categories.get(service.categorie.nom) ?? 0) + 1,
        );
      }
    }

    for (const client of clients) {
      const regionName = this.normalizeRegionName(client.adresse);
      const row = this.ensureRegion(byRegion, regionName);
      row.clients += 1;
    }

    return Array.from(byRegion.values())
      .map((region) => ({
        name: region.name,
        clients: region.clients,
        providers: region.providers,
        activeProviders: region.activeProviders,
        verifiedProviders: region.verifiedProviders,
        services: region.services,
        availableServices: region.availableServices,
        reservations: region.reservations,
        completedReservations: region.completedReservations,
        activeReservations: region.activeReservations,
        disputes: region.disputes,
        grossRevenue: region.grossRevenue,
        netRevenue: region.netRevenue,
        averageRating:
          region.ratedProviders > 0
            ? Math.round((region.ratingSum / region.ratedProviders) * 10) / 10
            : 0,
        verificationRate: this.percentage(
          region.verifiedProviders,
          region.providers,
        ),
        completionRate: this.percentage(
          region.completedReservations,
          region.reservations,
        ),
        topCategories: this.topCategories(region.categories),
      }))
      .sort((a, b) => {
        if (a.name === 'Region non renseignee' && b.name !== a.name) return 1;
        if (b.name === 'Region non renseignee' && a.name !== b.name) return -1;
        const scoreA =
          a.providers * 3 + a.clients + a.reservations + a.grossRevenue / 10000;
        const scoreB =
          b.providers * 3 + b.clients + b.reservations + b.grossRevenue / 10000;
        return scoreB - scoreA;
      });
  }

  private buildTotals(
    regions: Array<{
      clients: number;
      providers: number;
      activeProviders: number;
      verifiedProviders: number;
      services: number;
      availableServices: number;
      reservations: number;
      completedReservations: number;
      activeReservations: number;
      disputes: number;
      grossRevenue: number;
      netRevenue: number;
    }>,
    clients: number,
  ) {
    return regions.reduce<RegionTotals>(
      (totals, region) => ({
        clients,
        regions: SENEGAL_REGIONS.length,
        providers: totals.providers + region.providers,
        activeProviders: totals.activeProviders + region.activeProviders,
        verifiedProviders: totals.verifiedProviders + region.verifiedProviders,
        services: totals.services + region.services,
        availableServices: totals.availableServices + region.availableServices,
        reservations: totals.reservations + region.reservations,
        completedReservations:
          totals.completedReservations + region.completedReservations,
        activeReservations:
          totals.activeReservations + region.activeReservations,
        disputes: totals.disputes + region.disputes,
        grossRevenue: totals.grossRevenue + region.grossRevenue,
        netRevenue: totals.netRevenue + region.netRevenue,
      }),
      {
        clients,
        regions: 0,
        providers: 0,
        activeProviders: 0,
        verifiedProviders: 0,
        services: 0,
        availableServices: 0,
        reservations: 0,
        completedReservations: 0,
        activeReservations: 0,
        disputes: 0,
        grossRevenue: 0,
        netRevenue: 0,
      },
    );
  }

  private ensureRegion(
    rows: Map<string, RegionAccumulator>,
    name: string,
  ): RegionAccumulator {
    const existing = rows.get(name);
    if (existing) return existing;

    const row: RegionAccumulator = {
      name,
      clients: 0,
      providers: 0,
      activeProviders: 0,
      verifiedProviders: 0,
      services: 0,
      availableServices: 0,
      reservations: 0,
      completedReservations: 0,
      activeReservations: 0,
      disputes: 0,
      grossRevenue: 0,
      netRevenue: 0,
      ratingSum: 0,
      ratedProviders: 0,
      categories: new Map<string, number>(),
    };
    rows.set(name, row);
    return row;
  }

  private normalizeRegionName(value: string | null): string {
    const trimmed = value?.trim();
    if (!trimmed) return 'Region non renseignee';
    const normalized = this.normalizeSearchValue(trimmed);

    for (const [region, aliases] of Object.entries(REGION_ALIASES)) {
      const matchesRegion = aliases.some((alias) =>
        normalized.includes(this.normalizeSearchValue(alias)),
      );
      if (matchesRegion) {
        return region;
      }
    }

    return trimmed
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private topCategories(categories: Map<string, number>) {
    return Array.from(categories.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }

  private percentage(value: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  }

  private normalizeSearchValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }
}
