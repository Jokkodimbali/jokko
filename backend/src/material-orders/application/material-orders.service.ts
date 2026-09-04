import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutCommandeMateriel,
  StatutDevisMateriel,
  StatutKyc,
  StatutPaiement,
  StatutReservation,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { DeliveryPricingService } from '../../maps/application/delivery-pricing.service';
import { NotificationsService } from '../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../notifications/domain/entities/notification.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateMaterialOrderCommand,
  ValidateMaterialOrderCommand,
} from './material-orders.commands';

const MATERIAL_DELIVERY_PRICE_PER_KM = 500;

const ORDER_INCLUDE = {
  reservationSource: {
    select: {
      id: true,
      dateHeure: true,
      adresseClient: true,
      statut: true,
      service: { select: { id: true, nom: true } },
      professionnel: {
        select: { id: true, utilisateur: { select: { nom: true } } },
      },
    },
  },
  client: { select: { id: true, nom: true, adresse: true } },
  quincaillerie: {
    select: {
      id: true,
      nomEntreprise: true,
      ville: true,
      utilisateur: { select: { id: true, nom: true, adresse: true } },
    },
  },
  paiement: {
    select: { id: true, statut: true, methode: true, traiteLe: true },
  },
  reservationLivraison: {
    select: {
      id: true,
      serviceId: true,
      statut: true,
      professionnel: {
        select: {
          id: true,
          utilisateur: { select: { nom: true, urlAvatar: true } },
        },
      },
    },
  },
} as const;

type MaterialOrderRecord = Prisma.CommandeMaterielGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

type MaterialItem = {
  position: number;
  name: string;
  quantity: number;
  isAvailable: boolean;
  unitPrice: number | null;
};

@Injectable()
export class MaterialOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly deliveryPricing: DeliveryPricingService,
  ) {}

  async getAccess(requestUser: AuthUser) {
    const store = await this.prisma.profilProfessionnel.findFirst({
      where: {
        utilisateurId: requestUser.sub,
        estQuincaillerie: true,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: { estActif: true },
      },
      select: { id: true },
    });
    return { isHardwareStore: store !== null };
  }

  async getEligibility(requestUser: AuthUser, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        clientId: requestUser.sub,
      },
      select: {
        id: true,
        statut: true,
        devisMateriel: {
          where: { statut: StatutDevisMateriel.VALIDE },
          select: { id: true },
        },
        commandesMaterielSource: {
          orderBy: { creeLe: 'desc' },
          take: 1,
          select: { id: true, statut: true },
        },
      },
    });
    if (!reservation) {
      return {
        eligible: false,
        materialCount: 0,
        existingOrder: null,
      };
    }
    const canStartOrder =
      reservation.statut === StatutReservation.CONFIRMEE ||
      reservation.statut === StatutReservation.PAYEE_SEQUESTRE;
    return {
      eligible: canStartOrder && reservation.devisMateriel.length > 0,
      materialCount: reservation.devisMateriel.length,
      existingOrder: reservation.commandesMaterielSource[0]
        ? {
            id: reservation.commandesMaterielSource[0].id,
            status: reservation.commandesMaterielSource[0].statut,
          }
        : null,
    };
  }

  async listNearby(input: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  }) {
    const radiusMeters = Math.min(input.radiusKm ?? 25, 100) * 1000;
    const stores = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        latitude: number;
        longitude: number;
        distanceKm: number;
        rating: number;
        totalReviews: number;
      }>
    >(Prisma.sql`
      SELECT p.id, COALESCE(p.company_name, u.name) AS name, u.address, p.city,
        p.global_rating::float8 AS rating, p.total_reviews AS "totalReviews",
        ST_Y(p.localisation::geometry) AS latitude,
        ST_X(p.localisation::geometry) AS longitude,
        ST_Distance(
          p.localisation,
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
        ) / 1000 AS "distanceKm"
      FROM professional_profiles p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.is_hardware_store = true
        AND p.kyc_status = 'VERIFIE'
        AND u.is_active = true
        AND p.localisation IS NOT NULL
        AND ST_DWithin(
          p.localisation,
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceKm" ASC
      LIMIT 50
    `);
    return stores.map((store) => ({
      ...store,
      distanceKm: Number(store.distanceKm),
      rating: Number(store.rating),
      totalReviews: Number(store.totalReviews),
    }));
  }

  async create(requestUser: AuthUser, dto: CreateMaterialOrderCommand) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: dto.reservationId,
        clientId: requestUser.sub,
        statut: {
          in: [StatutReservation.CONFIRMEE, StatutReservation.PAYEE_SEQUESTRE],
        },
      },
      select: {
        id: true,
        devisMateriel: {
          where: { statut: StatutDevisMateriel.VALIDE },
          orderBy: { creeLe: 'asc' },
          select: { designation: true, quantite: true },
        },
      },
    });
    if (!reservation) {
      throw new NotFoundException(
        'Reservation confirmée introuvable ou prestation deja demarree.',
      );
    }
    if (reservation.devisMateriel.length === 0) {
      throw new BadRequestException(
        'Aucun materiel valide par le client ne doit etre recherche.',
      );
    }
    const store = await this.prisma.profilProfessionnel.findFirst({
      where: {
        id: dto.hardwareStoreId,
        estQuincaillerie: true,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: { estActif: true },
      },
      select: { id: true },
    });
    if (!store) {
      throw new NotFoundException('Quincaillerie introuvable ou non verifiee.');
    }
    const existing = await this.prisma.commandeMateriel.findUnique({
      where: {
        reservationSourceId_quincaillerieId: {
          reservationSourceId: reservation.id,
          quincaillerieId: store.id,
        },
      },
      include: ORDER_INCLUDE,
    });
    if (existing) return this.toView(existing);

    const order = await this.prisma.commandeMateriel.create({
      data: {
        reservationSourceId: reservation.id,
        clientId: requestUser.sub,
        quincaillerieId: store.id,
        detailsMateriel: reservation.devisMateriel.map((item, position) => ({
          position,
          name: item.designation,
          quantity: item.quantite,
          isAvailable: false,
          unitPrice: null,
        })),
      },
      include: ORDER_INCLUDE,
    });
    await this.notifications.createInAppNotification({
      userId: order.quincaillerie.utilisateur.id,
      type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
      title: 'Nouvelle demande de matériel',
      body: `${order.client.nom} vous demande de vérifier les fournitures nécessaires avant sa prestation.`,
      data: {
        materialOrderId: order.id,
        route: `/material-orders/${order.id}`,
      },
    });
    return this.toView(order);
  }

  async list(requestUser: AuthUser) {
    const professional = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: requestUser.sub },
      select: { id: true },
    });
    const orders = await this.prisma.commandeMateriel.findMany({
      where: professional
        ? {
            OR: [
              { clientId: requestUser.sub },
              { quincaillerieId: professional.id },
            ],
          }
        : { clientId: requestUser.sub },
      include: ORDER_INCLUDE,
      orderBy: { creeLe: 'desc' },
    });
    return orders.map((order) =>
      this.toView(order, {
        hideReservationDetails: order.quincaillerieId === professional?.id,
      }),
    );
  }

  async get(requestUser: AuthUser, orderId: string) {
    const professional = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: requestUser.sub },
      select: { id: true },
    });
    const order = await this.prisma.commandeMateriel.findFirst({
      where: {
        id: orderId,
        OR: [
          { clientId: requestUser.sub },
          ...(professional ? [{ quincaillerieId: professional.id }] : []),
        ],
      },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande materiel introuvable.');
    return this.toView(order, {
      hideReservationDetails: order.quincaillerieId === professional?.id,
    });
  }

  async getDeliveryOffer(requestUser: AuthUser, orderId: string) {
    const assignedOrder = await this.prisma.commandeMateriel.findFirst({
      where: {
        id: orderId,
        reservationLivraison: {
          professionnel: { utilisateurId: requestUser.sub },
        },
      },
      include: ORDER_INCLUDE,
    });
    if (assignedOrder) {
      return {
        ...this.toView(assignedOrder),
        courierDistanceKm: 0,
        pricePerKm: MATERIAL_DELIVERY_PRICE_PER_KM,
      };
    }

    const courier = await this.findEligibleCourier(requestUser.sub, orderId);
    if (!courier) {
      throw new ForbiddenException(
        "Cette livraison n'est pas disponible pour votre profil.",
      );
    }
    const order = await this.prisma.commandeMateriel.findFirst({
      where: {
        id: orderId,
        statut: StatutCommandeMateriel.EN_ATTENTE_TRANSPORTEUR,
      },
      include: ORDER_INCLUDE,
    });
    if (!order || !order.livraisonDemandee) {
      throw new NotFoundException('Cette livraison a deja ete attribuee.');
    }
    return {
      ...this.toView(order),
      courierDistanceKm: Number(courier.distanceKm),
      pricePerKm: MATERIAL_DELIVERY_PRICE_PER_KM,
    };
  }

  async acceptDelivery(requestUser: AuthUser, orderId: string) {
    const courier = await this.findEligibleCourier(requestUser.sub, orderId);
    if (!courier) {
      throw new ForbiddenException(
        "Cette livraison n'est pas disponible pour votre profil.",
      );
    }
    const orderForPricing = await this.prisma.commandeMateriel.findFirst({
      where: {
        id: orderId,
        statut: StatutCommandeMateriel.EN_ATTENTE_TRANSPORTEUR,
      },
      include: ORDER_INCLUDE,
    });
    if (
      !orderForPricing ||
      !orderForPricing.livraisonDemandee ||
      orderForPricing.montantLivraison === null ||
      orderForPricing.distanceLivraisonKm === null ||
      !orderForPricing.adresseLivraison
    ) {
      throw new BadRequestException(
        'Cette livraison vient deja d etre acceptee ou est incomplete.',
      );
    }
    const deliveryAmount = Number(orderForPricing.montantLivraison);
    const deliveryDistanceKm = Number(orderForPricing.distanceLivraisonKm);
    const commissionAmount = Math.round(
      (deliveryAmount * courier.commissionRate) / 100,
    );
    const reservationId = randomUUID();
    const accepted = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.commandeMateriel.updateMany({
        where: {
          id: orderId,
          statut: StatutCommandeMateriel.EN_ATTENTE_TRANSPORTEUR,
          reservationLivraisonId: null,
        },
        data: { statut: StatutCommandeMateriel.TRANSPORTEUR_ASSIGNE },
      });
      if (claimed.count !== 1) return false;

      await tx.reservation.create({
        data: {
          id: reservationId,
          clientId: orderForPricing.client.id,
          professionnelId: courier.professionalId,
          serviceId: courier.serviceId,
          dateHeure: new Date(),
          adresseClient: orderForPricing.adresseLivraison!,
          dureeMinutes: courier.durationMinutes,
          statut: StatutReservation.PAYEE_SEQUESTRE,
          prixConvenu: deliveryAmount,
          notes: [
            'Type de livraison: Materiel de prestation',
            `Expediteur: ${this.storeName(orderForPricing)}`,
            `Depart colis: ${this.storeAddress(orderForPricing)}`,
            `Destinataire: ${orderForPricing.client.nom}`,
            `Arrivee destinataire: ${orderForPricing.adresseLivraison}`,
            `Distance estimee: ${deliveryDistanceKm.toFixed(1)} km`,
            `Prix calcule: ${deliveryAmount} FCFA`,
            'Frais deja inclus dans le paiement de la commande materiel',
          ].join('. '),
        },
      });
      await tx.paiement.create({
        data: {
          reservationId,
          clientId: orderForPricing.client.id,
          professionalId: courier.professionalId,
          montant: deliveryAmount,
          montantCommission: commissionAmount,
          montantNet: deliveryAmount - commissionAmount,
          methode: orderForPricing.paiement?.methode ?? 'WAVE',
          statut: 'SUCCES',
          escrowStatus: 'LOCKED',
          referenceTransaction: `MATERIAL-DELIVERY-${orderId}`,
          processedAt: new Date(),
        },
      });
      await tx.commandeMateriel.update({
        where: { id: orderId },
        data: { reservationLivraisonId: reservationId },
      });
      return true;
    });
    if (!accepted) {
      throw new BadRequestException(
        'Cette livraison vient d etre acceptee par un autre livreur.',
      );
    }
    const order = await this.prisma.commandeMateriel.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    await Promise.all([
      this.notifications.createInAppNotification({
        userId: order.client.id,
        type: NOTIFICATION_TYPES.PRESTATAIRE_EN_ROUTE,
        title: 'Livreur affecté à votre matériel',
        body: `${order.reservationLivraison?.professionnel.utilisateur.nom ?? 'Votre livreur'} récupérera la commande en quincaillerie, puis la livrera à votre adresse.`,
        data: {
          materialOrderId: order.id,
          reservationId,
          route: `/appointments/${reservationId}`,
        },
      }),
      this.notifications.createInAppNotification({
        userId: order.quincaillerie.utilisateur.id,
        type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
        title: 'Livreur affecté au matériel',
        body: `${order.reservationLivraison?.professionnel.utilisateur.nom ?? 'Un livreur'} a accepté la course et viendra retirer la commande.`,
        data: {
          materialOrderId: order.id,
          route: `/material-orders/${order.id}`,
        },
      }),
    ]);
    return this.toView(order);
  }

  async validate(
    requestUser: AuthUser,
    orderId: string,
    dto: ValidateMaterialOrderCommand,
  ) {
    const store = await this.prisma.profilProfessionnel.findFirst({
      where: {
        utilisateurId: requestUser.sub,
        estQuincaillerie: true,
        statutKyc: StatutKyc.VERIFIE,
      },
      select: { id: true },
    });
    if (!store) {
      throw new ForbiddenException(
        'Seule une quincaillerie verifiee peut repondre a cette demande.',
      );
    }
    const order = await this.prisma.commandeMateriel.findFirst({
      where: { id: orderId, quincaillerieId: store.id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande materiel introuvable.');
    if (order.statut !== StatutCommandeMateriel.EN_ATTENTE_QUINCAILLERIE) {
      throw new BadRequestException('Cette demande a deja ete traitee.');
    }
    const requested = this.parseItems(order.detailsMateriel);
    if (dto.items.length !== requested.length) {
      throw new BadRequestException(
        'Chaque materiel demande doit etre marque disponible ou indisponible.',
      );
    }
    const byPosition = new Map(dto.items.map((item) => [item.position, item]));
    const items = requested.map((item) => {
      const answer = byPosition.get(item.position);
      if (!answer || answer.name.trim() !== item.name) {
        throw new BadRequestException(
          'La liste du materiel ne correspond pas au devis.',
        );
      }
      const unitPrice = Number(answer.unitPrice);
      if (
        answer.isAvailable &&
        (!Number.isFinite(unitPrice) || unitPrice <= 0)
      ) {
        throw new BadRequestException(
          `Renseignez le prix de ${item.name}, marque comme disponible.`,
        );
      }
      return {
        ...item,
        isAvailable: answer.isAvailable,
        unitPrice: answer.isAvailable ? Math.round(unitPrice) : null,
      };
    });
    const availableCount = items.filter((item) => item.isAvailable).length;
    const expectedStatus =
      availableCount === 0
        ? StatutCommandeMateriel.INDISPONIBLE
        : availableCount === items.length
          ? StatutCommandeMateriel.EN_ATTENTE_PAIEMENT
          : StatutCommandeMateriel.PARTIELLEMENT_DISPONIBLE;
    if (dto.status !== expectedStatus) {
      throw new BadRequestException(
        'Le statut ne correspond pas aux disponibilites renseignees.',
      );
    }
    const amount = items.reduce(
      (sum, item) =>
        sum + (item.isAvailable ? Number(item.unitPrice) * item.quantity : 0),
      0,
    );
    const updated = await this.prisma.commandeMateriel.update({
      where: { id: order.id },
      data: {
        statut: expectedStatus,
        montantMateriel: amount || null,
        detailsMateriel: items,
        indisponibilites: items
          .filter((item) => !item.isAvailable)
          .map((item) => item.name),
        noteQuincaillerie: dto.note?.trim() || null,
        valideeLe: new Date(),
      },
      include: ORDER_INCLUDE,
    });
    await this.notifications.createInAppNotification({
      userId: updated.client.id,
      type: NOTIFICATION_TYPES.RESERVATION_CONFIRMEE,
      title:
        expectedStatus === StatutCommandeMateriel.INDISPONIBLE
          ? 'Materiel indisponible'
          : expectedStatus === StatutCommandeMateriel.PARTIELLEMENT_DISPONIBLE
            ? 'Materiel partiellement disponible'
            : 'Materiel disponible',
      body: `${this.storeName(updated)} a verifie votre liste. Consultez le detail avant le debut de la prestation.`,
      data: {
        materialOrderId: updated.id,
        reservationId: updated.reservationSource.id,
        route: `/material-orders/${updated.id}`,
      },
    });
    return this.toView(updated, { hideReservationDetails: true });
  }

  async configureDelivery(
    requestUser: AuthUser,
    orderId: string,
    deliveryRequested: boolean,
  ) {
    const order = await this.prisma.commandeMateriel.findFirst({
      where: { id: orderId, clientId: requestUser.sub },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande materiel introuvable.');
    if (
      order.statut !== StatutCommandeMateriel.EN_ATTENTE_PAIEMENT &&
      order.statut !== StatutCommandeMateriel.PARTIELLEMENT_DISPONIBLE
    ) {
      throw new BadRequestException(
        "Le choix de livraison n'est plus modifiable.",
      );
    }
    if (order.paiement && order.paiement.statut !== StatutPaiement.ECHEC) {
      throw new BadRequestException(
        "Le choix de livraison n'est plus modifiable apres l'initialisation du paiement.",
      );
    }
    let deliveryData = {
      livraisonDemandee: false,
      montantLivraison: null as number | null,
      distanceLivraisonKm: null as number | null,
      adresseLivraison: null as string | null,
    };
    if (deliveryRequested) {
      const deliveryAddress =
        order.client.adresse || order.reservationSource.adresseClient;
      if (!deliveryAddress) {
        throw new BadRequestException(
          'Ajoutez une adresse client avant de demander la livraison.',
        );
      }
      const quote = await this.deliveryPricing.quote({
        pickupAddress: this.storeAddress(order),
        dropoffAddress: deliveryAddress,
        pricePerKm: MATERIAL_DELIVERY_PRICE_PER_KM,
        locationErrorLabel:
          'Impossible de localiser la quincaillerie ou le client.',
      });
      deliveryData = {
        livraisonDemandee: true,
        montantLivraison: quote.amount,
        distanceLivraisonKm: quote.distanceKm,
        adresseLivraison: deliveryAddress,
      };
    }
    const updated = await this.prisma.commandeMateriel.update({
      where: { id: order.id },
      data: deliveryData,
      include: ORDER_INCLUDE,
    });
    return this.toView(updated);
  }

  private parseItems(value: Prisma.JsonValue): MaterialItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry, fallbackPosition) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        return [];
      const item = entry as Record<string, Prisma.JsonValue>;
      const name = typeof item['name'] === 'string' ? item['name'].trim() : '';
      if (!name) return [];
      const unitPrice = Number(item['unitPrice']);
      return [
        {
          position:
            typeof item['position'] === 'number'
              ? item['position']
              : fallbackPosition,
          name,
          quantity: Math.max(1, Math.trunc(Number(item['quantity']) || 1)),
          isAvailable: item['isAvailable'] === true,
          unitPrice:
            Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
        },
      ];
    });
  }

  private async findEligibleCourier(userId: string, orderId: string) {
    const couriers = await this.prisma.$queryRaw<
      Array<{
        professionalId: string;
        serviceId: string;
        durationMinutes: number;
        distanceKm: number;
        commissionRate: number;
      }>
    >(Prisma.sql`
      SELECT p.id AS "professionalId", service.id AS "serviceId",
        service.duration_minutes AS "durationMinutes",
        category.commission_rate::float8 AS "commissionRate",
        ST_Distance(
          COALESCE(
            CASE
              WHEN presence.last_position_at >= NOW() - INTERVAL '15 minutes'
                AND presence.last_latitude IS NOT NULL
                AND presence.last_longitude IS NOT NULL
              THEN ST_SetSRID(ST_MakePoint(presence.last_longitude::float8, presence.last_latitude::float8), 4326)::geography
            END,
            p.localisation
          ),
          store.localisation
        ) / 1000 AS "distanceKm"
      FROM material_orders orders
      INNER JOIN professional_profiles store ON store.id = orders.hardware_store_id
      INNER JOIN professional_profiles p ON p.user_id = ${userId}::uuid
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN services service ON service.professional_id = p.id
      INNER JOIN categories category ON category.id = service.category_id
      LEFT JOIN professional_presence presence ON presence.professional_id = p.id
      WHERE orders.id = ${orderId}::uuid
        AND orders.statut = 'EN_ATTENTE_TRANSPORTEUR'
        AND store.localisation IS NOT NULL
        AND p.kyc_status = 'VERIFIE'
        AND u.is_active = true
        AND service.is_available = true
        AND service.travel_mode = 'TRANSPORT_COLIS'
        AND COALESCE(
          CASE
            WHEN presence.last_position_at >= NOW() - INTERVAL '15 minutes'
              AND presence.last_latitude IS NOT NULL
              AND presence.last_longitude IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(presence.last_longitude::float8, presence.last_latitude::float8), 4326)::geography
          END,
          p.localisation
        ) IS NOT NULL
        AND ST_DWithin(
          COALESCE(
            CASE
              WHEN presence.last_position_at >= NOW() - INTERVAL '15 minutes'
                AND presence.last_latitude IS NOT NULL
                AND presence.last_longitude IS NOT NULL
              THEN ST_SetSRID(ST_MakePoint(presence.last_longitude::float8, presence.last_latitude::float8), 4326)::geography
            END,
            p.localisation
          ),
          store.localisation,
          25000
        )
      ORDER BY "distanceKm" ASC, service.created_at ASC
      LIMIT 1
    `);
    return couriers[0] ?? null;
  }

  private storeName(order: MaterialOrderRecord): string {
    return (
      order.quincaillerie.nomEntreprise || order.quincaillerie.utilisateur.nom
    );
  }

  private storeAddress(order: MaterialOrderRecord): string {
    return (
      order.quincaillerie.utilisateur.adresse ||
      order.quincaillerie.ville ||
      this.storeName(order)
    );
  }

  private toView(
    order: MaterialOrderRecord,
    options: { hideReservationDetails?: boolean } = {},
  ) {
    return {
      id: order.id,
      status: order.statut,
      materialAmount:
        order.montantMateriel === null ? null : Number(order.montantMateriel),
      deliveryRequested: order.livraisonDemandee,
      deliveryAmount:
        order.montantLivraison === null ? null : Number(order.montantLivraison),
      deliveryDistanceKm:
        order.distanceLivraisonKm === null
          ? null
          : Number(order.distanceLivraisonKm),
      deliveryAddress: order.adresseLivraison,
      totalAmount:
        Number(order.montantMateriel ?? 0) +
        Number(order.montantLivraison ?? 0),
      note: order.noteQuincaillerie,
      unavailableItems: order.indisponibilites,
      items: this.parseItems(order.detailsMateriel),
      validatedAt: order.valideeLe,
      paidAt: order.payeeLe,
      payment: order.paiement
        ? {
            id: order.paiement.id,
            status: order.paiement.statut,
            method:
              order.paiement.methode === 'CARTE'
                ? 'CARD'
                : order.paiement.methode,
            processedAt: order.paiement.traiteLe,
          }
        : null,
      deliveryReservation: order.reservationLivraison
        ? {
            id: order.reservationLivraison.id,
            serviceId: order.reservationLivraison.serviceId,
            status: order.reservationLivraison.statut,
            courier: {
              professionalId: order.reservationLivraison.professionnel.id,
              name: order.reservationLivraison.professionnel.utilisateur.nom,
              avatarUrl:
                order.reservationLivraison.professionnel.utilisateur.urlAvatar,
            },
          }
        : null,
      reservation: options.hideReservationDetails
        ? null
        : {
            id: order.reservationSource.id,
            scheduledAt: order.reservationSource.dateHeure,
            status: order.reservationSource.statut,
            address: order.reservationSource.adresseClient,
            service: order.reservationSource.service,
            provider: {
              id: order.reservationSource.professionnel.id,
              name: order.reservationSource.professionnel.utilisateur.nom,
            },
          },
      client: order.client,
      hardwareStore: {
        id: order.quincaillerie.id,
        userId: order.quincaillerie.utilisateur.id,
        name: this.storeName(order),
      },
      createdAt: order.creeLe,
    };
  }
}
