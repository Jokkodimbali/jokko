import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  LiveTrackingRepositoryPort,
  ReservationTrackingContext,
  ReservationTrackingView,
} from '../../application/ports/live-tracking-repository.port';
import type { ProfessionalPresence } from '../../domain/entities/professional-presence.entity';
import type { ReservationTrackingSession } from '../../domain/entities/reservation-tracking-session.entity';

const TRACKING_INCLUDE = {
  professionnel: {
    select: {
      utilisateur: {
        select: {
          id: true,
        },
      },
      presence: true,
    },
  },
} as const;

type TrackingRecord = Prisma.SessionTrackingReservationGetPayload<{
  include: typeof TRACKING_INCLUDE;
}>;

@Injectable()
export class LiveTrackingRepository implements LiveTrackingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findReservationContext(
    reservationId: string,
  ): Promise<ReservationTrackingContext | null> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        clientId: true,
        professionnelId: true,
        statut: true,
        dateHeure: true,
        adresseClient: true,
        service: {
          select: {
            nom: true,
            modeDeplacement: true,
          },
        },
        professionnel: {
          select: {
            nomEntreprise: true,
            ville: true,
            utilisateur: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      return null;
    }

    return {
      reservationId: reservation.id,
      clientUserId: reservation.clientId,
      professionalId: reservation.professionnelId,
      professionalUserId: reservation.professionnel.utilisateur.id,
      professionalName: reservation.professionnel.utilisateur.nom,
      serviceName: reservation.service.nom,
      travelMode: reservation.service.modeDeplacement,
      dateHeure: reservation.dateHeure,
      adresseClient: reservation.adresseClient,
      adresseDestinationPrestataire: this.buildProfessionalDestinationAddress({
        companyName: reservation.professionnel.nomEntreprise,
        city: reservation.professionnel.ville,
        professionalName: reservation.professionnel.utilisateur.nom,
      }),
      reservationStatus: reservation.statut,
    };
  }

  private buildProfessionalDestinationAddress(input: {
    companyName: string | null;
    city: string | null;
    professionalName: string;
  }): string {
    const city = input.city?.trim();
    const companyName = input.companyName?.trim();
    if (companyName && city) return `${companyName}, ${city}`;
    if (city) return city;
    return input.professionalName;
  }

  async findProfessionalPresence(
    professionalId: string,
  ): Promise<ProfessionalPresence | null> {
    const presence = await this.prisma.presenceProfessionnel.findUnique({
      where: { profilProfessionnelId: professionalId },
    });

    return presence ? this.mapPresence(presence) : null;
  }

  async findTrackingByReservationId(
    reservationId: string,
  ): Promise<ReservationTrackingView | null> {
    const record = await this.prisma.sessionTrackingReservation.findUnique({
      where: { reservationId },
      include: TRACKING_INCLUDE,
    });

    return record ? this.mapTracking(record) : null;
  }

  async upsertPresence(input: {
    professionalId: string;
    isOnline?: boolean;
    status?: 'HORS_LIGNE' | 'EN_LIGNE' | 'EN_ROUTE' | 'EN_PRESTATION';
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): Promise<ProfessionalPresence> {
    const now = new Date();
    const saved = await this.prisma.presenceProfessionnel.upsert({
      where: { profilProfessionnelId: input.professionalId },
      create: {
        profilProfessionnelId: input.professionalId,
        estEnLigne: input.isOnline ?? false,
        statut: input.status ?? 'HORS_LIGNE',
        derniereLatitude: this.toDecimal(input.latitude),
        derniereLongitude: this.toDecimal(input.longitude),
        dernierePrecisionMetres: this.toDecimal(input.accuracyMeters),
        derniereOrientationDegres: input.headingDegrees ?? null,
        derniereVitesseKmh: this.toDecimal(input.speedKmh),
        dernierLibelleLocalisation: input.locationLabel ?? null,
        dernierePositionLe:
          input.latitude !== null &&
          input.latitude !== undefined &&
          input.longitude !== null &&
          input.longitude !== undefined
            ? now
            : null,
        dernierVueLe: now,
      },
      update: {
        ...(input.isOnline !== undefined ? { estEnLigne: input.isOnline } : {}),
        ...(input.status ? { statut: input.status } : {}),
        ...(input.latitude !== undefined
          ? { derniereLatitude: this.toDecimal(input.latitude) }
          : {}),
        ...(input.longitude !== undefined
          ? { derniereLongitude: this.toDecimal(input.longitude) }
          : {}),
        ...(input.accuracyMeters !== undefined
          ? { dernierePrecisionMetres: this.toDecimal(input.accuracyMeters) }
          : {}),
        ...(input.headingDegrees !== undefined
          ? { derniereOrientationDegres: input.headingDegrees }
          : {}),
        ...(input.speedKmh !== undefined
          ? { derniereVitesseKmh: this.toDecimal(input.speedKmh) }
          : {}),
        ...(input.locationLabel !== undefined
          ? { dernierLibelleLocalisation: input.locationLabel }
          : {}),
        dernierVueLe: now,
        ...(input.latitude !== undefined && input.longitude !== undefined
          ? { dernierePositionLe: now }
          : {}),
      },
    });

    return this.mapPresence(saved);
  }

  async startOrResumeTracking(input: {
    session: ReservationTrackingSession;
    presence: ProfessionalPresence;
  }): Promise<ReservationTrackingView> {
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.presenceProfessionnel.upsert({
        where: { profilProfessionnelId: input.presence.professionalId },
        create: {
          profilProfessionnelId: input.presence.professionalId,
          estEnLigne: input.presence.isOnline,
          statut: input.presence.status,
          derniereLatitude: this.toDecimal(input.presence.lastLatitude),
          derniereLongitude: this.toDecimal(input.presence.lastLongitude),
          dernierePrecisionMetres: this.toDecimal(
            input.presence.lastAccuracyMeters,
          ),
          derniereOrientationDegres: input.presence.lastHeadingDegrees,
          derniereVitesseKmh: this.toDecimal(input.presence.lastSpeedKmh),
          dernierLibelleLocalisation: input.presence.lastLocationLabel,
          dernierePositionLe: input.presence.lastPositionAt,
          dernierVueLe: input.presence.lastSeenAt,
        },
        update: {
          estEnLigne: input.presence.isOnline,
          statut: input.presence.status,
          derniereLatitude: this.toDecimal(input.presence.lastLatitude),
          derniereLongitude: this.toDecimal(input.presence.lastLongitude),
          dernierePrecisionMetres: this.toDecimal(
            input.presence.lastAccuracyMeters,
          ),
          derniereOrientationDegres: input.presence.lastHeadingDegrees,
          derniereVitesseKmh: this.toDecimal(input.presence.lastSpeedKmh),
          dernierLibelleLocalisation: input.presence.lastLocationLabel,
          dernierePositionLe: input.presence.lastPositionAt,
          dernierVueLe: input.presence.lastSeenAt,
        },
      });

      const session = await tx.sessionTrackingReservation.upsert({
        where: { reservationId: input.session.reservationId },
        create: {
          reservationId: input.session.reservationId,
          clientId: input.session.clientUserId,
          professionnelId: input.session.professionalId,
          statut:
            input.session.trackingStatus === 'INACTIF'
              ? 'EN_ROUTE'
              : input.session.trackingStatus,
          derniereLatitude: this.toDecimal(input.session.lastLatitude),
          derniereLongitude: this.toDecimal(input.session.lastLongitude),
          dernierePrecisionMetres: this.toDecimal(
            input.session.lastAccuracyMeters,
          ),
          derniereOrientationDegres: input.session.lastHeadingDegrees,
          derniereVitesseKmh: this.toDecimal(input.session.lastSpeedKmh),
          dernierLibelleLocalisation: input.session.lastLocationLabel,
          dernierePositionLe: input.session.lastPositionAt,
          demarreLe: input.session.startedAt ?? new Date(),
          termineLe: null,
        },
        update: {
          statut: 'EN_ROUTE',
          termineLe: null,
          derniereLatitude: this.toDecimal(input.session.lastLatitude),
          derniereLongitude: this.toDecimal(input.session.lastLongitude),
          dernierePrecisionMetres: this.toDecimal(
            input.session.lastAccuracyMeters,
          ),
          derniereOrientationDegres: input.session.lastHeadingDegrees,
          derniereVitesseKmh: this.toDecimal(input.session.lastSpeedKmh),
          dernierLibelleLocalisation: input.session.lastLocationLabel,
          dernierePositionLe: input.session.lastPositionAt,
          demarreLe: input.session.startedAt ?? new Date(),
        },
        include: TRACKING_INCLUDE,
      });

      if (
        input.session.lastLatitude !== null &&
        input.session.lastLongitude !== null
      ) {
        await tx.pointTrackingReservation.create({
          data: {
            sessionTrackingId: session.id,
            latitude: this.requiredDecimal(input.session.lastLatitude),
            longitude: this.requiredDecimal(input.session.lastLongitude),
            precisionMetres: this.toDecimal(input.session.lastAccuracyMeters),
            orientationDegres: input.session.lastHeadingDegrees,
            vitesseKmh: this.toDecimal(input.session.lastSpeedKmh),
            libelleLocalisation: input.session.lastLocationLabel,
            enregistreLe: input.session.lastPositionAt ?? new Date(),
          },
        });
      }

      return session;
    });

    return this.mapTracking(saved);
  }

  async startOrResumeTravelerTracking(input: {
    session: ReservationTrackingSession;
  }): Promise<ReservationTrackingView> {
    const saved = await this.prisma.$transaction(async (tx) => {
      const session = await tx.sessionTrackingReservation.upsert({
        where: { reservationId: input.session.reservationId },
        create: {
          reservationId: input.session.reservationId,
          clientId: input.session.clientUserId,
          professionnelId: input.session.professionalId,
          statut:
            input.session.trackingStatus === 'INACTIF'
              ? 'EN_ROUTE'
              : input.session.trackingStatus,
          derniereLatitude: this.toDecimal(input.session.lastLatitude),
          derniereLongitude: this.toDecimal(input.session.lastLongitude),
          dernierePrecisionMetres: this.toDecimal(
            input.session.lastAccuracyMeters,
          ),
          derniereOrientationDegres: input.session.lastHeadingDegrees,
          derniereVitesseKmh: this.toDecimal(input.session.lastSpeedKmh),
          dernierLibelleLocalisation: input.session.lastLocationLabel,
          dernierePositionLe: input.session.lastPositionAt,
          demarreLe: input.session.startedAt ?? new Date(),
          termineLe: null,
        },
        update: {
          statut: 'EN_ROUTE',
          termineLe: null,
          derniereLatitude: this.toDecimal(input.session.lastLatitude),
          derniereLongitude: this.toDecimal(input.session.lastLongitude),
          dernierePrecisionMetres: this.toDecimal(
            input.session.lastAccuracyMeters,
          ),
          derniereOrientationDegres: input.session.lastHeadingDegrees,
          derniereVitesseKmh: this.toDecimal(input.session.lastSpeedKmh),
          dernierLibelleLocalisation: input.session.lastLocationLabel,
          dernierePositionLe: input.session.lastPositionAt,
          demarreLe: input.session.startedAt ?? new Date(),
        },
        include: TRACKING_INCLUDE,
      });

      if (
        input.session.lastLatitude !== null &&
        input.session.lastLongitude !== null
      ) {
        await tx.pointTrackingReservation.create({
          data: {
            sessionTrackingId: session.id,
            latitude: this.requiredDecimal(input.session.lastLatitude),
            longitude: this.requiredDecimal(input.session.lastLongitude),
            precisionMetres: this.toDecimal(input.session.lastAccuracyMeters),
            orientationDegres: input.session.lastHeadingDegrees,
            vitesseKmh: this.toDecimal(input.session.lastSpeedKmh),
            libelleLocalisation: input.session.lastLocationLabel,
            enregistreLe: input.session.lastPositionAt ?? new Date(),
          },
        });
      }

      return session;
    });

    return this.mapTracking(saved);
  }

  async recordTrackingLocation(input: {
    reservationId: string;
    professionalId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): Promise<ReservationTrackingView | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sessionTrackingReservation.findUnique({
        where: { reservationId: input.reservationId },
        include: TRACKING_INCLUDE,
      });

      if (
        !existing ||
        existing.professionnelId !== input.professionalId ||
        existing.statut !== 'EN_ROUTE'
      ) {
        return null;
      }

      const now = new Date();

      await tx.presenceProfessionnel.upsert({
        where: { profilProfessionnelId: input.professionalId },
        create: {
          profilProfessionnelId: input.professionalId,
          estEnLigne: true,
          statut: 'EN_ROUTE',
          derniereLatitude: this.requiredDecimal(input.latitude),
          derniereLongitude: this.requiredDecimal(input.longitude),
          dernierePrecisionMetres: this.toDecimal(input.accuracyMeters),
          derniereOrientationDegres: input.headingDegrees ?? null,
          derniereVitesseKmh: this.toDecimal(input.speedKmh),
          dernierLibelleLocalisation: input.locationLabel ?? null,
          dernierePositionLe: now,
          dernierVueLe: now,
        },
        update: {
          estEnLigne: true,
          statut: 'EN_ROUTE',
          derniereLatitude: this.requiredDecimal(input.latitude),
          derniereLongitude: this.requiredDecimal(input.longitude),
          dernierePrecisionMetres: this.toDecimal(input.accuracyMeters),
          derniereOrientationDegres: input.headingDegrees ?? null,
          derniereVitesseKmh: this.toDecimal(input.speedKmh),
          dernierLibelleLocalisation: input.locationLabel ?? null,
          dernierePositionLe: now,
          dernierVueLe: now,
        },
      });

      await tx.pointTrackingReservation.create({
        data: {
          sessionTrackingId: existing.id,
          latitude: this.requiredDecimal(input.latitude),
          longitude: this.requiredDecimal(input.longitude),
          precisionMetres: this.toDecimal(input.accuracyMeters),
          orientationDegres: input.headingDegrees ?? null,
          vitesseKmh: this.toDecimal(input.speedKmh),
          libelleLocalisation: input.locationLabel ?? null,
          enregistreLe: now,
        },
      });

      return tx.sessionTrackingReservation.update({
        where: { id: existing.id },
        data: {
          derniereLatitude: this.requiredDecimal(input.latitude),
          derniereLongitude: this.requiredDecimal(input.longitude),
          dernierePrecisionMetres: this.toDecimal(input.accuracyMeters),
          derniereOrientationDegres: input.headingDegrees ?? null,
          derniereVitesseKmh: this.toDecimal(input.speedKmh),
          dernierLibelleLocalisation: input.locationLabel ?? null,
          dernierePositionLe: now,
        },
        include: TRACKING_INCLUDE,
      });
    });

    return record ? this.mapTracking(record) : null;
  }

  async recordTravelerTrackingLocation(input: {
    reservationId: string;
    professionalId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): Promise<ReservationTrackingView | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sessionTrackingReservation.findUnique({
        where: { reservationId: input.reservationId },
        include: TRACKING_INCLUDE,
      });

      if (
        !existing ||
        existing.professionnelId !== input.professionalId ||
        existing.statut !== 'EN_ROUTE'
      ) {
        return null;
      }

      const now = new Date();
      await tx.pointTrackingReservation.create({
        data: {
          sessionTrackingId: existing.id,
          latitude: this.requiredDecimal(input.latitude),
          longitude: this.requiredDecimal(input.longitude),
          precisionMetres: this.toDecimal(input.accuracyMeters),
          orientationDegres: input.headingDegrees ?? null,
          vitesseKmh: this.toDecimal(input.speedKmh),
          libelleLocalisation: input.locationLabel ?? null,
          enregistreLe: now,
        },
      });

      return tx.sessionTrackingReservation.update({
        where: { id: existing.id },
        data: {
          derniereLatitude: this.requiredDecimal(input.latitude),
          derniereLongitude: this.requiredDecimal(input.longitude),
          dernierePrecisionMetres: this.toDecimal(input.accuracyMeters),
          derniereOrientationDegres: input.headingDegrees ?? null,
          derniereVitesseKmh: this.toDecimal(input.speedKmh),
          dernierLibelleLocalisation: input.locationLabel ?? null,
          dernierePositionLe: now,
        },
        include: TRACKING_INCLUDE,
      });
    });

    return record ? this.mapTracking(record) : null;
  }

  async startReservationFromArrival(input: {
    reservationId: string;
    professionalId: string;
  }): Promise<ReservationTrackingView | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          professionnelId: true,
          statut: true,
        },
      });

      if (
        !reservation ||
        reservation.professionnelId !== input.professionalId ||
        reservation.statut !== 'PAYEE_SEQUESTRE'
      ) {
        return null;
      }

      const existing = await tx.sessionTrackingReservation.findUnique({
        where: { reservationId: input.reservationId },
        include: TRACKING_INCLUDE,
      });

      if (
        !existing ||
        existing.professionnelId !== input.professionalId ||
        existing.statut !== 'EN_ROUTE'
      ) {
        return null;
      }

      const now = new Date();
      await tx.reservation.update({
        where: { id: input.reservationId },
        data: {
          statut: 'EN_COURS',
          misAJourLe: now,
        },
      });

      await tx.presenceProfessionnel.upsert({
        where: { profilProfessionnelId: input.professionalId },
        create: {
          profilProfessionnelId: input.professionalId,
          estEnLigne: true,
          statut: 'EN_PRESTATION',
          dernierVueLe: now,
        },
        update: {
          estEnLigne: true,
          statut: 'EN_PRESTATION',
          dernierVueLe: now,
        },
      });

      return tx.sessionTrackingReservation.update({
        where: { id: existing.id },
        data: {
          statut: 'TERMINEE',
          termineLe: now,
        },
        include: TRACKING_INCLUDE,
      });
    });

    return record ? this.mapTracking(record) : null;
  }

  async finalizeTrackingForReservation(input: {
    reservationId: string;
    professionalId: string;
    trackingStatus: 'TERMINEE' | 'ANNULEE';
    nextPresenceStatus:
      | 'HORS_LIGNE'
      | 'EN_LIGNE'
      | 'EN_ROUTE'
      | 'EN_PRESTATION';
  }): Promise<ReservationTrackingView | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sessionTrackingReservation.findUnique({
        where: { reservationId: input.reservationId },
        include: TRACKING_INCLUDE,
      });

      await tx.presenceProfessionnel.updateMany({
        where: { profilProfessionnelId: input.professionalId },
        data: {
          statut: input.nextPresenceStatus,
          dernierVueLe: new Date(),
        },
      });

      if (!existing || existing.professionnelId !== input.professionalId) {
        return null;
      }

      return tx.sessionTrackingReservation.update({
        where: { id: existing.id },
        data: {
          statut: input.trackingStatus,
          termineLe: new Date(),
        },
        include: TRACKING_INCLUDE,
      });
    });

    return record ? this.mapTracking(record) : null;
  }

  private mapTracking(record: TrackingRecord): ReservationTrackingView {
    return {
      reservationId: record.reservationId,
      clientUserId: record.clientId,
      professionalId: record.professionnelId,
      professionalUserId: record.professionnel.utilisateur.id,
      trackingStatus: record.statut,
      startedAt: record.demarreLe,
      endedAt: record.termineLe,
      lastLatitude: this.toNumber(record.derniereLatitude),
      lastLongitude: this.toNumber(record.derniereLongitude),
      lastAccuracyMeters: this.toNumber(record.dernierePrecisionMetres),
      lastHeadingDegrees: record.derniereOrientationDegres,
      lastSpeedKmh: this.toNumber(record.derniereVitesseKmh),
      lastLocationLabel: record.dernierLibelleLocalisation,
      lastPositionAt: record.dernierePositionLe,
      updatedAt: record.misAJourLe,
      presence: record.professionnel.presence
        ? this.mapPresence(record.professionnel.presence)
        : {
            professionalId: record.professionnelId,
            isOnline: false,
            status: 'HORS_LIGNE',
            lastLatitude: null,
            lastLongitude: null,
            lastAccuracyMeters: null,
            lastHeadingDegrees: null,
            lastSpeedKmh: null,
            lastLocationLabel: null,
            lastPositionAt: null,
            lastSeenAt: null,
            updatedAt: record.misAJourLe,
          },
    };
  }

  private mapPresence(record: {
    profilProfessionnelId: string;
    estEnLigne: boolean;
    statut: string;
    derniereLatitude: Prisma.Decimal | null;
    derniereLongitude: Prisma.Decimal | null;
    dernierePrecisionMetres: Prisma.Decimal | null;
    derniereOrientationDegres: number | null;
    derniereVitesseKmh: Prisma.Decimal | null;
    dernierLibelleLocalisation: string | null;
    dernierePositionLe: Date | null;
    dernierVueLe: Date | null;
    misAJourLe: Date;
  }): ProfessionalPresence {
    return {
      professionalId: record.profilProfessionnelId,
      isOnline: record.estEnLigne,
      status: record.statut as ProfessionalPresence['status'],
      lastLatitude: this.toNumber(record.derniereLatitude),
      lastLongitude: this.toNumber(record.derniereLongitude),
      lastAccuracyMeters: this.toNumber(record.dernierePrecisionMetres),
      lastHeadingDegrees: record.derniereOrientationDegres,
      lastSpeedKmh: this.toNumber(record.derniereVitesseKmh),
      lastLocationLabel: record.dernierLibelleLocalisation,
      lastPositionAt: record.dernierePositionLe,
      lastSeenAt: record.dernierVueLe,
      updatedAt: record.misAJourLe,
    };
  }

  private toNumber(value: Prisma.Decimal | null): number | null {
    return value ? value.toNumber() : null;
  }

  private toDecimal(value: number | null | undefined): Prisma.Decimal | null {
    if (value === null || value === undefined) {
      return null;
    }

    return new Prisma.Decimal(value);
  }

  private requiredDecimal(value: number): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
}
