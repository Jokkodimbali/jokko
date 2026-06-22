import { Injectable } from '@nestjs/common';
import { Prisma, RoleNegociateur, StatutNegotiation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateNegotiationInput,
  NegotiationListQuery,
  NegotiationOfferView,
  NegotiationView,
  NegotiationsRepositoryPort,
  UpdateNegotiationInput,
} from '../../application/ports/negotiations-repository.port';

const NEGOTIATION_INCLUDE = {
  client: {
    select: {
      id: true,
      nom: true,
      adresse: true,
      urlAvatar: true,
    },
  },
  service: {
    select: {
      id: true,
      nom: true,
      prix: true,
    },
  },
  professionnel: {
    select: {
      id: true,
      utilisateurId: true,
      nomEntreprise: true,
      utilisateur: {
        select: {
          nom: true,
        },
      },
    },
  },
  propositions: {
    orderBy: { creeLe: 'asc' as const },
  },
} as const;

type NegotiationRecord = Prisma.NegotiationGetPayload<{
  include: typeof NEGOTIATION_INCLUDE;
}>;

@Injectable()
export class NegotiationsRepository implements NegotiationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNegotiationInput): Promise<NegotiationView> {
    const created = await this.prisma.negotiation.create({
      data: {
        id: input.id,
        clientId: input.clientId,
        professionnelId: input.professionnelId,
        serviceId: input.serviceId,
        statut: this.toPrismaStatus(input.statut),
        montantInitial: input.montantInitial,
        montantCourant: input.montantCourant,
        montantAccepte: input.montantAccepte,
        dernierProposePar: this.toPrismaActor(input.dernierProposePar),
        messageCourant: input.messageCourant,
        dateHeureProposee: input.dateHeureProposee,
        adresseClientProposee: input.adresseClientProposee,
        dureeMinutesProposee: input.dureeMinutesProposee,
        raisonCloture: input.raisonCloture,
        reservationId: input.reservationId,
        creeLe: input.creeLe,
        misAJourLe: input.misAJourLe,
        propositions: {
          create: {
            id: input.initialOffer.id,
            proposePar: this.toPrismaActor(input.initialOffer.proposePar),
            montant: input.initialOffer.montant,
            message: input.initialOffer.message,
            creeLe: input.initialOffer.creeLe,
          },
        },
      },
      include: NEGOTIATION_INCLUDE,
    });

    return this.toView(created);
  }

  async createIfNoActive(
    input: CreateNegotiationInput,
  ): Promise<NegotiationView | null> {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.lockActiveNegotiationSlot(tx, input.clientId, input.serviceId);

      const existingActive = await tx.negotiation.findFirst({
        where: {
          clientId: input.clientId,
          serviceId: input.serviceId,
          statut: {
            in: [
              StatutNegotiation.EN_ATTENTE_CLIENT,
              StatutNegotiation.EN_ATTENTE_PRESTATAIRE,
            ],
          },
        },
        select: { id: true },
      });

      if (existingActive) {
        return null;
      }

      return tx.negotiation.create({
        data: {
          id: input.id,
          clientId: input.clientId,
          professionnelId: input.professionnelId,
          serviceId: input.serviceId,
          statut: this.toPrismaStatus(input.statut),
          montantInitial: input.montantInitial,
          montantCourant: input.montantCourant,
          montantAccepte: input.montantAccepte,
          dernierProposePar: this.toPrismaActor(input.dernierProposePar),
          messageCourant: input.messageCourant,
          dateHeureProposee: input.dateHeureProposee,
          adresseClientProposee: input.adresseClientProposee,
          dureeMinutesProposee: input.dureeMinutesProposee,
          raisonCloture: input.raisonCloture,
          reservationId: input.reservationId,
          creeLe: input.creeLe,
          misAJourLe: input.misAJourLe,
          propositions: {
            create: {
              id: input.initialOffer.id,
              proposePar: this.toPrismaActor(input.initialOffer.proposePar),
              montant: input.initialOffer.montant,
              message: input.initialOffer.message,
              creeLe: input.initialOffer.creeLe,
            },
          },
        },
        include: NEGOTIATION_INCLUDE,
      });
    });

    return created ? this.toView(created) : null;
  }

  async findById(negotiationId: string): Promise<NegotiationView | null> {
    const negotiation = await this.prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: NEGOTIATION_INCLUDE,
    });

    return negotiation ? this.toView(negotiation) : null;
  }

  async listByActor(query: NegotiationListQuery): Promise<NegotiationView[]> {
    const where: Prisma.NegotiationWhereInput = {
      statut: query.status ? this.toPrismaStatus(query.status) : undefined,
    };

    if (query.scope === 'CLIENT') {
      where.clientId = query.userId;
    } else {
      const profile = await this.prisma.profilProfessionnel.findUnique({
        where: { utilisateurId: query.userId },
        select: { id: true },
      });

      if (!profile) {
        return [];
      }

      where.professionnelId = profile.id;
    }

    const negotiations = await this.prisma.negotiation.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: NEGOTIATION_INCLUDE,
    });

    return negotiations.map((negotiation) => this.toView(negotiation));
  }

  async findActiveByClientAndService(
    clientId: string,
    serviceId: string,
  ): Promise<Pick<NegotiationView, 'id'> | null> {
    const negotiation = await this.prisma.negotiation.findFirst({
      where: {
        clientId,
        serviceId,
        statut: {
          in: [
            StatutNegotiation.EN_ATTENTE_CLIENT,
            StatutNegotiation.EN_ATTENTE_PRESTATAIRE,
          ],
        },
      },
      select: { id: true },
      orderBy: { creeLe: 'desc' },
    });

    return negotiation;
  }

  async update(input: UpdateNegotiationInput): Promise<NegotiationView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.negotiation.update({
        where: { id: input.id },
        data: {
          statut: this.toPrismaStatus(input.statut),
          montantCourant: input.montantCourant,
          montantAccepte: input.montantAccepte,
          dernierProposePar: this.toPrismaActor(input.dernierProposePar),
          messageCourant: input.messageCourant,
          dateHeureProposee: input.dateHeureProposee,
          adresseClientProposee: input.adresseClientProposee,
          dureeMinutesProposee: input.dureeMinutesProposee,
          raisonCloture: input.raisonCloture,
          reservationId: input.reservationId,
          misAJourLe: input.misAJourLe,
        },
      });

      if (input.newOffer) {
        await tx.propositionNegotiation.create({
          data: {
            id: input.newOffer.id,
            negotiationId: input.id,
            proposePar: this.toPrismaActor(input.newOffer.proposePar),
            montant: input.newOffer.montant,
            message: input.newOffer.message,
            creeLe: input.newOffer.creeLe,
          },
        });
      }

      return tx.negotiation.findUniqueOrThrow({
        where: { id: input.id },
        include: NEGOTIATION_INCLUDE,
      });
    });

    return this.toView(updated);
  }

  private toView(record: NegotiationRecord): NegotiationView {
    return {
      id: record.id,
      clientId: record.clientId,
      professionnelId: record.professionnelId,
      serviceId: record.serviceId,
      statut: record.statut,
      montantInitial: Number(record.montantInitial),
      montantCourant: Number(record.montantCourant),
      montantAccepte:
        record.montantAccepte === null ? null : Number(record.montantAccepte),
      dernierProposePar: record.dernierProposePar,
      messageCourant: record.messageCourant,
      dateHeureProposee: record.dateHeureProposee,
      adresseClientProposee: record.adresseClientProposee,
      dureeMinutesProposee: record.dureeMinutesProposee,
      raisonCloture: record.raisonCloture,
      reservationId: record.reservationId,
      creeLe: record.creeLe,
      misAJourLe: record.misAJourLe,
      propositions: record.propositions.map((offer) =>
        this.toOfferView(record.id, offer),
      ),
      client: record.client,
      service: {
        ...record.service,
        prix: record.service.prix.toNumber(),
      },
      professionnel: record.professionnel,
    };
  }

  private toOfferView(
    negotiationId: string,
    offer: {
      id: string;
      proposePar: RoleNegociateur;
      montant: Prisma.Decimal;
      message: string | null;
      creeLe: Date;
    },
  ): NegotiationOfferView {
    return {
      id: offer.id,
      negotiationId,
      proposePar: offer.proposePar,
      montant: Number(offer.montant),
      message: offer.message,
      creeLe: offer.creeLe,
    };
  }

  private toPrismaStatus(status: NegotiationView['statut']): StatutNegotiation {
    return StatutNegotiation[status];
  }

  private toPrismaActor(actor: NegotiationView['dernierProposePar']) {
    return RoleNegociateur[actor];
  }

  private async lockActiveNegotiationSlot(
    tx: Prisma.TransactionClient,
    clientId: string,
    serviceId: string,
  ): Promise<void> {
    const lockKey = `${clientId}:${serviceId}`;
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${lockKey}), 1)
    `;
  }
}
