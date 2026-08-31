import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MethodePaiement,
  Prisma,
  StatutCommandePharmacie,
  StatutPaiement,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../../notifications/domain/entities/notification.entity';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PAYMENT_GATEWAY_PORT,
  type PaymentGateway,
} from '../ports/payment-gateway.port';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';

type PharmacyPaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'CARD';

@Injectable()
export class PharmacyOrderPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly gateway: PaymentGateway,
  ) {}

  async initiate(
    requestUser: AuthUser,
    orderId: string,
    input: {
      method: PharmacyPaymentMethod;
      successUrl?: string;
      cancelUrl?: string;
      callbackUrl?: string;
      idempotencyKey?: string;
    },
  ) {
    if (requestUser.role !== 'CLIENT') {
      throw new ForbiddenException(
        'Seul le patient peut payer cette commande.',
      );
    }
    const idempotencyKey = input.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw new BadRequestException("La cle d'idempotence est obligatoire.");
    }
    const order = await this.prisma.commandePharmacie.findFirst({
      where: { id: orderId, clientId: requestUser.sub },
      include: {
        client: {
          select: {
            nom: true,
            email: true,
            numeroTelephone: true,
          },
        },
        pharmacie: {
          select: {
            nomEntreprise: true,
            utilisateur: { select: { nom: true } },
          },
        },
        paiement: true,
      },
    });
    if (!order) throw new NotFoundException('Commande pharmacie introuvable.');
    if (
      (order.statut !== StatutCommandePharmacie.EN_ATTENTE_PAIEMENT &&
        order.statut !== StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE) ||
      order.montantMedicaments === null
    ) {
      throw new BadRequestException(
        "Cette commande n'est pas disponible pour le paiement.",
      );
    }

    if (order.paiement) {
      if (
        order.paiement.statut !== StatutPaiement.ECHEC &&
        order.paiement.cleIdempotence !== idempotencyKey
      ) {
        throw new ConflictException(
          'Un paiement a deja ete initialise pour cette commande.',
        );
      }
      if (order.paiement.statut !== StatutPaiement.ECHEC) {
        return this.toView(order.paiement);
      }
      await this.prisma.paiementCommandePharmacie.delete({
        where: { id: order.paiement.id },
      });
    }

    const totalAmount =
      Number(order.montantMedicaments) +
      (order.livraisonDemandee ? Number(order.montantLivraison ?? 0) : 0);
    if (order.livraisonDemandee && Number(order.montantLivraison ?? 0) <= 0) {
      throw new BadRequestException(
        'Le devis de livraison doit etre calcule avant le paiement.',
      );
    }

    const payment = await this.prisma.paiementCommandePharmacie.create({
      data: {
        commandePharmacieId: order.id,
        clientId: order.clientId,
        pharmacieId: order.pharmacieId,
        montant: totalAmount,
        methode: this.toPrismaMethod(input.method),
        cleIdempotence: idempotencyKey,
        referenceTransaction: `PHA-${randomUUID()}`,
      },
    });

    const gatewayResult = await this.gateway.initiatePayment({
      amount: totalAmount,
      currency: 'XOF',
      description: `${order.livraisonDemandee ? 'Medicaments et livraison' : 'Medicaments'} - ${order.pharmacie.nomEntreprise || order.pharmacie.utilisateur.nom}`,
      customerName: order.client.nom,
      customerEmail: order.client.email ?? undefined,
      customerPhone: order.client.numeroTelephone,
      callbackUrl: input.callbackUrl,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        pharmacyOrderId: order.id,
        pharmacyOrderPaymentId: payment.id,
      },
      method: PaymentMethod[input.method],
    });

    if (
      !gatewayResult.success ||
      !gatewayResult.gatewayReference ||
      !gatewayResult.paymentUrl
    ) {
      await this.prisma.paiementCommandePharmacie.update({
        where: { id: payment.id },
        data: {
          statut: StatutPaiement.ECHEC,
          erreur: gatewayResult.error || 'Echec de la passerelle de paiement.',
        },
      });
      throw new BadRequestException(
        gatewayResult.error || "Impossible d'initialiser le paiement.",
      );
    }

    const initiated = await this.prisma.paiementCommandePharmacie.update({
      where: { id: payment.id },
      data: {
        referenceFournisseur: gatewayResult.gatewayReference,
        urlPaiement: gatewayResult.paymentUrl,
      },
    });
    return this.toView(initiated);
  }

  async confirmMock(requestUser: AuthUser, orderId: string) {
    if (
      this.config.get<string>('NODE_ENV') === 'production' ||
      (this.config.get<string>('PAYMENT_GATEWAY_MODE') ?? 'mock') !== 'mock'
    ) {
      throw new ForbiddenException(
        'La confirmation manuelle est interdite avec la passerelle active.',
      );
    }
    const payment = await this.prisma.paiementCommandePharmacie.findFirst({
      where: { commandePharmacieId: orderId, clientId: requestUser.sub },
    });
    if (!payment)
      throw new NotFoundException('Paiement pharmacie introuvable.');
    return this.complete(
      payment.referenceFournisseur ?? payment.referenceTransaction,
    );
  }

  async processGatewayStatus(
    gatewayReference: string,
    status: string,
  ): Promise<boolean> {
    const payment = await this.prisma.paiementCommandePharmacie.findFirst({
      where: { referenceFournisseur: gatewayReference },
    });
    if (!payment) return false;

    const normalized = status.toLowerCase();
    if (['completed', 'success', 'succeeded', 'paid'].includes(normalized)) {
      await this.complete(gatewayReference);
    } else if (['failed', 'cancelled', 'canceled'].includes(normalized)) {
      await this.prisma.paiementCommandePharmacie.updateMany({
        where: { id: payment.id, statut: StatutPaiement.EN_ATTENTE },
        data: {
          statut: StatutPaiement.ECHEC,
          erreur: 'Paiement refuse ou annule par la passerelle.',
          traiteLe: new Date(),
        },
      });
    }
    return true;
  }

  private async complete(reference: string) {
    const payment = await this.prisma.paiementCommandePharmacie.findFirst({
      where: {
        OR: [
          { referenceFournisseur: reference },
          { referenceTransaction: reference },
        ],
      },
      include: {
        commandePharmacie: true,
        pharmacie: {
          select: {
            id: true,
            nomEntreprise: true,
            utilisateur: { select: { id: true, nom: true } },
          },
        },
      },
    });
    if (!payment)
      throw new NotFoundException('Paiement pharmacie introuvable.');
    if (payment.statut === StatutPaiement.SUCCES) return this.toView(payment);

    const completed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paiementCommandePharmacie.updateMany({
        where: { id: payment.id, statut: StatutPaiement.EN_ATTENTE },
        data: {
          statut: StatutPaiement.SUCCES,
          traiteLe: new Date(),
          erreur: null,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.paiementCommandePharmacie.findUniqueOrThrow({
          where: { id: payment.id },
        });
        if (current.statut !== StatutPaiement.SUCCES) {
          throw new ConflictException(
            'Ce paiement ne peut plus etre confirme.',
          );
        }
        return current;
      }

      const orderClaimed = await tx.commandePharmacie.updateMany({
        where: {
          id: payment.commandePharmacieId,
          statut: {
            in: [
              StatutCommandePharmacie.EN_ATTENTE_PAIEMENT,
              StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE,
            ],
          },
        },
        data: {
          statut: payment.commandePharmacie.livraisonDemandee
            ? StatutCommandePharmacie.EN_ATTENTE_TRANSPORTEUR
            : StatutCommandePharmacie.PAYEE_PHARMACIE,
          payeePharmacieLe: new Date(),
        },
      });
      if (orderClaimed.count !== 1) {
        throw new ConflictException(
          "La commande n'est plus en attente de paiement.",
        );
      }
      const pharmacy = await tx.profilProfessionnel.update({
        where: { id: payment.pharmacieId },
        data: {
          soldePortefeuille: {
            increment: payment.commandePharmacie.montantMedicaments!,
          },
        },
        select: { soldePortefeuille: true },
      });
      await tx.transactionPortefeuille.create({
        data: {
          profilProfessionnelId: payment.pharmacieId,
          type: TypeTransactionPortefeuille.CREDIT_PHARMACIE,
          montant: payment.commandePharmacie.montantMedicaments!,
          soldeApres: pharmacy.soldePortefeuille,
          description: `Paiement medicaments commande ${payment.commandePharmacieId}`,
          reference: `PHARMACY-PAYMENT-${payment.id}`,
        },
      });
      return tx.paiementCommandePharmacie.findUniqueOrThrow({
        where: { id: payment.id },
      });
    });

    await Promise.all([
      this.notifications.createInAppNotification({
        userId: payment.clientId,
        type: NOTIFICATION_TYPES.ORDONNANCE_MISE_A_JOUR,
        title: 'Paiement des medicaments confirme',
        body: payment.commandePharmacie.livraisonDemandee
          ? 'Votre paiement incluant la livraison est confirme. Nous recherchons maintenant un livreur de colis.'
          : 'Votre paiement est confirme. Vos medicaments seront a retirer directement a la pharmacie.',
        data: {
          pharmacyOrderId: payment.commandePharmacieId,
          route: payment.commandePharmacie.livraisonDemandee
            ? `/pharmacy-orders/${payment.commandePharmacieId}/delivery`
            : `/pharmacy-orders/${payment.commandePharmacieId}`,
        },
      }),
      this.notifications.createInAppNotification({
        userId: payment.pharmacie.utilisateur.id,
        type: NOTIFICATION_TYPES.ORDONNANCE_MISE_A_JOUR,
        title: 'Paiement pharmacie recu',
        body: `Le paiement des medicaments de ${Number(payment.commandePharmacie.montantMedicaments).toLocaleString('fr-FR')} FCFA est confirme.`,
        data: {
          pharmacyOrderId: payment.commandePharmacieId,
          route: `/pharmacy-orders/${payment.commandePharmacieId}`,
        },
      }),
    ]);
    if (payment.commandePharmacie.livraisonDemandee) {
      await this.notifyNearbyCouriers(payment.commandePharmacieId);
    }
    return this.toView(completed);
  }

  private async notifyNearbyCouriers(orderId: string): Promise<void> {
    const couriers = await this.prisma.$queryRaw<
      Array<{ userId: string; distanceKm: number }>
    >(Prisma.sql`
      SELECT DISTINCT p.user_id AS "userId",
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
      INNER JOIN professional_profiles p ON p.id <> pharmacy.id
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN services service ON service.professional_id = p.id
      LEFT JOIN professional_presence presence ON presence.professional_id = p.id
      WHERE orders.id = ${orderId}::uuid
        AND orders.delivery_requested = true
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
      ORDER BY "distanceKm" ASC
      LIMIT 50
    `);

    await Promise.allSettled(
      couriers.map((courier) =>
        this.notifications.createInAppNotification({
          userId: courier.userId,
          type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
          title: 'Livraison de medicaments disponible',
          body: `Une livraison est disponible a ${Number(courier.distanceKm).toFixed(1)} km. Acceptez-la pour recuperer la commande en pharmacie.`,
          data: {
            pharmacyOrderId: orderId,
            distanceKm: Number(courier.distanceKm),
            route: `/pharmacy-orders/${orderId}/delivery-offer`,
          },
        }),
      ),
    );
  }

  private toPrismaMethod(method: PharmacyPaymentMethod): MethodePaiement {
    return method === 'CARD' ? MethodePaiement.CARTE : MethodePaiement[method];
  }

  private toView(payment: {
    id: string;
    commandePharmacieId: string;
    montant: unknown;
    methode: MethodePaiement;
    statut: StatutPaiement;
    referenceTransaction: string;
    referenceFournisseur: string | null;
    urlPaiement: string | null;
    traiteLe: Date | null;
  }) {
    return {
      id: payment.id,
      pharmacyOrderId: payment.commandePharmacieId,
      amount: Number(payment.montant),
      method:
        payment.methode === MethodePaiement.CARTE ? 'CARD' : payment.methode,
      status: payment.statut,
      transactionReference: payment.referenceTransaction,
      gatewayReference: payment.referenceFournisseur,
      paymentUrl: payment.urlPaiement,
      processedAt: payment.traiteLe,
    };
  }
}
