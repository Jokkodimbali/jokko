import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutCommandePharmacie,
  StatutKyc,
  StatutReservation,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_TYPES } from '../../notifications/domain/entities/notification.entity';
import { NotificationsService } from '../../notifications/application/services/notifications.service';
import { GeocodeAddressUseCase } from '../../geolocation/application/use-cases/geocode-address.use-case';
import { ComputeRoutesUseCase } from '../../routing/application/use-cases/compute-routes.use-case';
import type {
  CreatePharmacyOrderCommand,
  ValidatePharmacyOrderCommand,
} from './pharmacy-orders.commands';

const ORDER_INCLUDE = {
  reservationMedicale: {
    select: {
      id: true,
      dateHeure: true,
      adresseClient: true,
      actesPrescriptionMedicale: true,
      vaccinsPrescriptionMedicale: true,
      traitementsPrescriptionMedicale: true,
      service: { select: { nom: true, categorie: { select: { nom: true } } } },
      professionnel: {
        select: {
          noteGlobale: true,
          nombreAvis: true,
          utilisateur: { select: { nom: true, urlAvatar: true } },
        },
      },
    },
  },
  client: {
    select: { id: true, nom: true, numeroTelephone: true, adresse: true },
  },
  pharmacie: {
    select: {
      id: true,
      nomEntreprise: true,
      ville: true,
      utilisateur: { select: { id: true, nom: true, adresse: true } },
    },
  },
  paiement: {
    select: {
      id: true,
      statut: true,
      methode: true,
      traiteLe: true,
    },
  },
  reservationLivraison: {
    select: {
      id: true,
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

type PharmacyOrderRecord = Prisma.CommandePharmacieGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

type PharmacyMedicineItem = {
  position: number;
  name: string;
  isAvailable: boolean;
  price: number | null;
};

@Injectable()
export class PharmacyOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly geocodeAddress: GeocodeAddressUseCase,
    private readonly computeRoutes: ComputeRoutesUseCase,
  ) {}

  async getAccess(requestUser: AuthUser) {
    const pharmacy = await this.prisma.profilProfessionnel.findFirst({
      where: {
        utilisateurId: requestUser.sub,
        estPharmacie: true,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: { estActif: true },
      },
      select: { id: true },
    });
    return { isPharmacy: pharmacy !== null };
  }

  async create(requestUser: AuthUser, dto: CreatePharmacyOrderCommand) {
    if (requestUser.role !== 'CLIENT')
      throw new ForbiddenException(
        'Seul le patient peut envoyer son ordonnance a une pharmacie.',
      );

    const medicalReservation = await this.prisma.reservation.findFirst({
      where: {
        id: dto.medicalReservationId,
        clientId: requestUser.sub,
        statut: StatutReservation.TERMINEE,
      },
      include: { service: { include: { categorie: true } } },
    });
    if (!medicalReservation)
      throw new NotFoundException(
        'Consultation medicale terminee introuvable.',
      );
    if (!this.isMedicalReservation(medicalReservation.service)) {
      throw new BadRequestException(
        'Seule une consultation medicale terminee peut etre envoyee a une pharmacie.',
      );
    }

    const pharmacy = await this.prisma.profilProfessionnel.findFirst({
      where: {
        id: dto.pharmacyId,
        estPharmacie: true,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: { estActif: true },
      },
      select: { id: true },
    });
    if (!pharmacy)
      throw new NotFoundException('Pharmacie introuvable ou non verifiee.');

    const order = await this.prisma.commandePharmacie.create({
      data: {
        reservationMedicaleId: medicalReservation.id,
        clientId: requestUser.sub,
        pharmacieId: pharmacy.id,
      },
      include: ORDER_INCLUDE,
    });
    await this.notifications.createInAppNotification({
      userId: order.pharmacie.utilisateur.id,
      type: NOTIFICATION_TYPES.ORDONNANCE_RECUE,
      title: 'Nouvelle ordonnance a verifier',
      body: `${order.client.nom} vous a envoye une ordonnance apres sa consultation.`,
      data: {
        pharmacyOrderId: order.id,
        medicalReservationId: order.reservationMedicale.id,
        route: `/pharmacy-orders/${order.id}`,
      },
    });
    return this.toView(order);
  }

  async list(requestUser: AuthUser) {
    const professional = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: requestUser.sub },
      select: { id: true },
    });
    const orders = await this.prisma.commandePharmacie.findMany({
      where: professional
        ? {
            OR: [
              { clientId: requestUser.sub },
              { pharmacieId: professional.id },
            ],
          }
        : { clientId: requestUser.sub },
      include: ORDER_INCLUDE,
      orderBy: { creeLe: 'desc' },
    });
    return orders.map((order) => this.toView(order));
  }

  async listNearbyPharmacies(input: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  }) {
    const radiusMeters = Math.min(input.radiusKm ?? 25, 100) * 1000;
    const pharmacies = await this.prisma.$queryRaw<
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
        ST_Y(p.localisation::geometry) AS latitude, ST_X(p.localisation::geometry) AS longitude,
        ST_Distance(p.localisation, ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography) / 1000 AS "distanceKm"
      FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
      WHERE p.is_pharmacy = true AND p.kyc_status = 'VERIFIE' AND u.is_active = true
        AND p.localisation IS NOT NULL
        AND ST_DWithin(p.localisation, ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography, ${radiusMeters})
      ORDER BY "distanceKm" ASC LIMIT 50
    `);
    return pharmacies.map((pharmacy) => ({
      ...pharmacy,
      distanceKm: Number(pharmacy.distanceKm),
      rating: Number(pharmacy.rating),
      totalReviews: Number(pharmacy.totalReviews),
    }));
  }

  async get(requestUser: AuthUser, orderId: string) {
    const professional = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: requestUser.sub },
      select: { id: true },
    });
    const order = await this.prisma.commandePharmacie.findFirst({
      where: {
        id: orderId,
        OR: [
          { clientId: requestUser.sub },
          ...(professional ? [{ pharmacieId: professional.id }] : []),
        ],
      },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande pharmacie introuvable.');
    return this.toView(order);
  }

  async getDeliveryOffer(requestUser: AuthUser, orderId: string) {
    const courier = await this.findEligibleCourier(requestUser.sub, orderId);
    if (!courier) {
      throw new ForbiddenException(
        "Cette livraison n'est pas disponible pour votre profil.",
      );
    }
    const order = await this.prisma.commandePharmacie.findFirst({
      where: {
        id: orderId,
        statut: StatutCommandePharmacie.EN_ATTENTE_TRANSPORTEUR,
      },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Cette livraison a deja ete attribuee.');
    }
    const deliveryPricing = await this.calculateDeliveryPricing({
      pickupAddress: this.pharmacyAddress(order),
      dropoffAddress:
        order.client.adresse || order.reservationMedicale.adresseClient,
      pricePerKm: courier.pricePerKm,
    });
    return {
      ...this.toView(order),
      distanceKm: courier.distanceKm,
      deliveryDistanceKm: deliveryPricing.distanceKm,
      deliveryAmount: deliveryPricing.amount,
      pricePerKm: courier.pricePerKm,
    };
  }

  async acceptDelivery(requestUser: AuthUser, orderId: string) {
    const courier = await this.findEligibleCourier(requestUser.sub, orderId);
    if (!courier) {
      throw new ForbiddenException(
        "Cette livraison n'est pas disponible pour votre profil.",
      );
    }

    const orderForPricing = await this.prisma.commandePharmacie.findFirst({
      where: {
        id: orderId,
        statut: StatutCommandePharmacie.EN_ATTENTE_TRANSPORTEUR,
      },
      include: ORDER_INCLUDE,
    });
    if (!orderForPricing) {
      throw new BadRequestException(
        'Cette livraison vient deja d etre acceptee par un autre livreur.',
      );
    }
    const pickupAddress = this.pharmacyAddress(orderForPricing);
    const dropoffAddress =
      orderForPricing.client.adresse ||
      orderForPricing.reservationMedicale.adresseClient;
    const deliveryPricing = await this.calculateDeliveryPricing({
      pickupAddress,
      dropoffAddress,
      pricePerKm: courier.pricePerKm,
    });
    const reservationId = randomUUID();
    const accepted = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.commandePharmacie.updateMany({
        where: {
          id: orderId,
          statut: StatutCommandePharmacie.EN_ATTENTE_TRANSPORTEUR,
          reservationLivraisonId: null,
        },
        data: { statut: StatutCommandePharmacie.TRANSPORTEUR_ASSIGNE },
      });
      if (claimed.count !== 1) return false;

      const order = await tx.commandePharmacie.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          client: { select: { adresse: true } },
          pharmacie: {
            select: {
              nomEntreprise: true,
              ville: true,
              utilisateur: { select: { nom: true, adresse: true } },
            },
          },
        },
      });
      const pharmacyName =
        order.pharmacie.nomEntreprise || order.pharmacie.utilisateur.nom;
      await tx.reservation.create({
        data: {
          id: reservationId,
          clientId: order.clientId,
          professionnelId: courier.professionalId,
          serviceId: courier.serviceId,
          dateHeure: new Date(),
          adresseClient: dropoffAddress,
          dureeMinutes: courier.durationMinutes,
          statut: StatutReservation.CONFIRMEE,
          prixConvenu: deliveryPricing.amount,
          notes: [
            'Type de livraison: Medicaments',
            `Expediteur: ${pharmacyName}`,
            `Depart colis: ${pickupAddress}`,
            `Destinataire: Client`,
            `Arrivee destinataire: ${dropoffAddress}`,
            `Distance estimee: ${deliveryPricing.distanceKm.toFixed(1)} km`,
            `Tarif kilometrique: ${courier.pricePerKm} FCFA`,
            `Prix calcule: ${deliveryPricing.amount} FCFA`,
            'Note livraison: Paiement de livraison separe',
          ].join('. '),
        },
      });
      await tx.commandePharmacie.update({
        where: { id: orderId },
        data: { reservationLivraisonId: reservationId },
      });
      return true;
    });

    if (!accepted) {
      throw new BadRequestException(
        'Cette livraison vient deja d etre acceptee par un autre livreur.',
      );
    }

    const order = await this.prisma.commandePharmacie.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    await Promise.all([
      this.notifications.createInAppNotification({
        userId: order.client.id,
        type: NOTIFICATION_TYPES.PRESTATAIRE_EN_ROUTE,
        title: 'Livreur affecte : paiement de la livraison',
        body: `${order.reservationLivraison?.professionnel.utilisateur.nom ?? 'Votre livreur'} a accepte la livraison. Frais : ${deliveryPricing.amount.toLocaleString('fr-FR')} FCFA.`,
        data: {
          pharmacyOrderId: order.id,
          reservationId,
          route: `/appointments/${reservationId}/payment`,
        },
      }),
      this.notifications.createInAppNotification({
        userId: order.pharmacie.utilisateur.id,
        type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
        title: 'Livreur affecte',
        body: `${order.reservationLivraison?.professionnel.utilisateur.nom ?? 'Un livreur'} a accepte la course. Le depart suivra le paiement de la livraison.`,
        data: {
          pharmacyOrderId: order.id,
          reservationId,
          route: `/pharmacy-orders/${order.id}`,
        },
      }),
    ]);
    return this.toView(order);
  }

  async validate(
    requestUser: AuthUser,
    orderId: string,
    dto: ValidatePharmacyOrderCommand,
  ) {
    const pharmacy = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: requestUser.sub },
      select: { id: true, estPharmacie: true, statutKyc: true },
    });
    if (
      !pharmacy ||
      !pharmacy.estPharmacie ||
      pharmacy.statutKyc !== StatutKyc.VERIFIE
    )
      throw new ForbiddenException(
        'Seule la pharmacie selectionnee peut valider cette commande.',
      );
    const order = await this.prisma.commandePharmacie.findFirst({
      where: { id: orderId, pharmacieId: pharmacy.id },
      select: {
        id: true,
        pharmacieId: true,
        statut: true,
        reservationMedicale: {
          select: {
            actesPrescriptionMedicale: true,
            vaccinsPrescriptionMedicale: true,
            traitementsPrescriptionMedicale: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Commande pharmacie introuvable.');
    if (order.statut !== StatutCommandePharmacie.EN_ATTENTE_PHARMACIE) {
      throw new BadRequestException('Cette commande a deja ete traitee.');
    }

    const prescribedMedicines = [
      ...order.reservationMedicale.actesPrescriptionMedicale,
      ...order.reservationMedicale.vaccinsPrescriptionMedicale,
      ...order.reservationMedicale.traitementsPrescriptionMedicale,
    ]
      .map((name) => name.trim())
      .filter(Boolean);
    const medicineItems = (dto.medicineItems ?? [])
      .map((item) => ({
        position: item.position,
        name: item.name.trim(),
        isAvailable: item.isAvailable,
        price: item.isAvailable ? Math.round(Number(item.price)) : null,
      }))
      .sort((left, right) => left.position - right.position);

    if (medicineItems.length !== prescribedMedicines.length) {
      throw new BadRequestException(
        'Renseignez la disponibilite de chaque medicament prescrit.',
      );
    }
    medicineItems.forEach((item, position) => {
      if (
        item.position !== position ||
        item.name !== prescribedMedicines[position]
      ) {
        throw new BadRequestException(
          "La liste des medicaments ne correspond pas a l'ordonnance.",
        );
      }
      if (
        item.isAvailable &&
        (!Number.isFinite(item.price) ||
          (item.price ?? 0) <= 0 ||
          (item.price ?? 0) > 100_000_000)
      ) {
        throw new BadRequestException(
          `Renseignez le prix du medicament disponible : ${item.name}.`,
        );
      }
    });

    const availableItems = medicineItems.filter((item) => item.isAvailable);
    const unavailableItems = medicineItems
      .filter((item) => !item.isAvailable)
      .map((item) => item.name);
    if (dto.status === 'EN_ATTENTE_PAIEMENT' && unavailableItems.length > 0) {
      throw new BadRequestException(
        'Tous les medicaments doivent etre disponibles pour accepter toute la commande.',
      );
    }
    if (
      dto.status === 'PARTIELLEMENT_DISPONIBLE' &&
      (availableItems.length === 0 || unavailableItems.length === 0)
    ) {
      throw new BadRequestException(
        'Une disponibilite partielle doit contenir au moins un medicament disponible et un indisponible.',
      );
    }
    if (dto.status === 'INDISPONIBLE' && availableItems.length > 0) {
      throw new BadRequestException(
        'Aucun medicament ne peut etre marque disponible pour une commande indisponible.',
      );
    }

    const medicineAmount = availableItems.reduce(
      (total, item) => total + (item.price ?? 0),
      0,
    );
    const updateResult = await this.prisma.commandePharmacie.updateMany({
      where: {
        id: order.id,
        pharmacieId: pharmacy.id,
        statut: StatutCommandePharmacie.EN_ATTENTE_PHARMACIE,
      },
      data: {
        statut: dto.status,
        montantMedicaments: medicineAmount > 0 ? medicineAmount : null,
        detailsMedicaments: medicineItems as Prisma.InputJsonValue,
        notePharmacie: dto.pharmacyNote?.trim() || null,
        indisponibilites: unavailableItems,
        valideePharmacieLe: new Date(),
      },
    });
    if (updateResult.count !== 1) {
      throw new BadRequestException('Cette commande a deja ete traitee.');
    }
    const updated = await this.prisma.commandePharmacie.findFirst({
      where: { id: order.id, pharmacieId: pharmacy.id },
      include: ORDER_INCLUDE,
    });
    if (!updated) {
      throw new NotFoundException('Commande pharmacie introuvable.');
    }
    await this.notifications.createInAppNotification({
      userId: updated.client.id,
      type: NOTIFICATION_TYPES.ORDONNANCE_MISE_A_JOUR,
      title: this.clientNotificationTitle(updated.statut),
      body: this.clientNotificationBody(updated),
      data: {
        pharmacyOrderId: updated.id,
        medicalReservationId: updated.reservationMedicale.id,
        route: `/pharmacy-orders/${updated.id}`,
      },
    });
    return this.toView(updated);
  }

  private isMedicalReservation(service: {
    nom: string;
    categorie: { nom: string };
  }): boolean {
    return /sante|medical|medecin|consultation|clinique|soin/i.test(
      `${service.nom} ${service.categorie.nom}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    );
  }

  private async findEligibleCourier(userId: string, orderId: string) {
    const couriers = await this.prisma.$queryRaw<
      Array<{
        professionalId: string;
        serviceId: string;
        durationMinutes: number;
        distanceKm: number;
        pricePerKm: number;
      }>
    >(Prisma.sql`
      SELECT p.id AS "professionalId", service.id AS "serviceId",
        service.duration_minutes AS "durationMinutes",
        service.price::float8 AS "pricePerKm",
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
          pharmacy.localisation
        ) / 1000 AS "distanceKm"
      FROM pharmacy_orders orders
      INNER JOIN professional_profiles pharmacy ON pharmacy.id = orders.pharmacy_id
      INNER JOIN professional_profiles p ON p.user_id = ${userId}::uuid
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN services service ON service.professional_id = p.id
      LEFT JOIN professional_presence presence ON presence.professional_id = p.id
      WHERE orders.id = ${orderId}::uuid
        AND orders.statut = 'EN_ATTENTE_TRANSPORTEUR'
        AND pharmacy.localisation IS NOT NULL
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
          pharmacy.localisation,
          25000
        )
      ORDER BY "distanceKm" ASC, service.created_at ASC
      LIMIT 1
    `);
    return couriers[0] ?? null;
  }

  private pharmacyAddress(order: PharmacyOrderRecord): string {
    return (
      order.pharmacie.utilisateur.adresse ||
      order.pharmacie.ville ||
      order.pharmacie.nomEntreprise ||
      order.pharmacie.utilisateur.nom
    );
  }

  private async calculateDeliveryPricing(input: {
    pickupAddress: string;
    dropoffAddress: string;
    pricePerKm: number;
  }): Promise<{ distanceKm: number; amount: number }> {
    const [pickup, dropoff] = await Promise.all([
      this.geocodeAddress.execute(input.pickupAddress),
      this.geocodeAddress.execute(input.dropoffAddress),
    ]);
    if (!pickup || !dropoff) {
      throw new BadRequestException(
        'Impossible de localiser la pharmacie ou le client pour calculer la livraison.',
      );
    }
    const routes = await this.computeRoutes.execute({
      origin: pickup,
      destination: dropoff,
      alternatives: false,
    });
    const distanceMeters = routes.find(
      (route) => Number(route.distanceMeters) > 0,
    )?.distanceMeters;
    if (!distanceMeters) {
      throw new BadRequestException(
        'Impossible de calculer la distance de livraison.',
      );
    }
    const distanceKm = distanceMeters / 1000;
    return {
      distanceKm,
      amount: Math.max(500, Math.round(distanceKm * input.pricePerKm)),
    };
  }

  private clientNotificationTitle(status: StatutCommandePharmacie): string {
    switch (status) {
      case StatutCommandePharmacie.EN_ATTENTE_PAIEMENT:
        return 'Ordonnance validee : paiement disponible';
      case StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE:
        return 'Ordonnance partiellement disponible';
      default:
        return 'Medicaments indisponibles';
    }
  }

  private clientNotificationBody(order: PharmacyOrderRecord): string {
    if (order.statut === StatutCommandePharmacie.EN_ATTENTE_PAIEMENT) {
      return `${order.pharmacie.nomEntreprise || order.pharmacie.utilisateur.nom} a valide votre ordonnance. Prix fixe : ${Number(order.montantMedicaments).toLocaleString('fr-FR')} FCFA.`;
    }
    if (order.statut === StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE) {
      return `${order.pharmacie.nomEntreprise || order.pharmacie.utilisateur.nom} peut fournir une partie des medicaments prescrits pour ${Number(order.montantMedicaments).toLocaleString('fr-FR')} FCFA.`;
    }
    return `${order.pharmacie.nomEntreprise || order.pharmacie.utilisateur.nom} ne peut pas fournir les medicaments demandes pour le moment.`;
  }

  private toView(order: PharmacyOrderRecord) {
    const medicineItems = this.parseMedicineItems(order.detailsMedicaments);
    return {
      id: order.id,
      status: order.statut,
      medicineAmount:
        order.montantMedicaments === null
          ? null
          : Number(order.montantMedicaments),
      pharmacyNote: order.notePharmacie,
      unavailableItems: order.indisponibilites,
      medicineItems,
      validatedAt: order.valideePharmacieLe,
      paidAt: order.payeePharmacieLe,
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
            status: order.reservationLivraison.statut,
            courier: {
              professionalId: order.reservationLivraison.professionnel.id,
              name: order.reservationLivraison.professionnel.utilisateur.nom,
              avatarUrl:
                order.reservationLivraison.professionnel.utilisateur.urlAvatar,
            },
          }
        : null,
      medicalReservation: {
        id: order.reservationMedicale.id,
        scheduledAt: order.reservationMedicale.dateHeure,
        prescription: {
          acts: order.reservationMedicale.actesPrescriptionMedicale,
          vaccines: order.reservationMedicale.vaccinsPrescriptionMedicale,
          treatments: order.reservationMedicale.traitementsPrescriptionMedicale,
        },
        prescriber: {
          name: order.reservationMedicale.professionnel.utilisateur.nom,
          avatarUrl:
            order.reservationMedicale.professionnel.utilisateur.urlAvatar,
          specialty:
            order.reservationMedicale.service.categorie.nom ||
            order.reservationMedicale.service.nom,
          rating: Number(order.reservationMedicale.professionnel.noteGlobale),
          totalReviews: order.reservationMedicale.professionnel.nombreAvis,
        },
      },
      client: order.client,
      pharmacy: {
        id: order.pharmacie.id,
        name: order.pharmacie.nomEntreprise || order.pharmacie.utilisateur.nom,
        userId: order.pharmacie.utilisateur.id,
      },
      createdAt: order.creeLe,
    };
  }

  private parseMedicineItems(value: Prisma.JsonValue): PharmacyMedicineItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry, fallbackPosition) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        return [];
      const item = entry as Record<string, Prisma.JsonValue>;
      const name = typeof item['name'] === 'string' ? item['name'].trim() : '';
      if (!name) return [];
      const price = Number(item['price']);
      return [
        {
          position:
            typeof item['position'] === 'number'
              ? item['position']
              : fallbackPosition,
          name,
          isAvailable: item['isAvailable'] === true,
          price: Number.isFinite(price) && price > 0 ? price : null,
        },
      ];
    });
  }
}
