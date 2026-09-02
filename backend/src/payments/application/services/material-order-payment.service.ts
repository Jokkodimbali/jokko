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
  StatutCommandeMateriel,
  StatutPaiement,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../../notifications/domain/entities/notification.entity';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';
import {
  PAYMENT_GATEWAY_PORT,
  type PaymentGateway,
} from '../ports/payment-gateway.port';

type MaterialPaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'CARD';

@Injectable()
export class MaterialOrderPaymentService {
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
      method: MaterialPaymentMethod;
      successUrl?: string;
      cancelUrl?: string;
      callbackUrl?: string;
      idempotencyKey?: string;
    },
  ) {
    const idempotencyKey = input.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw new BadRequestException("La cle d'idempotence est obligatoire.");
    }
    const order = await this.prisma.commandeMateriel.findFirst({
      where: { id: orderId, clientId: requestUser.sub },
      include: {
        client: { select: { nom: true, email: true, numeroTelephone: true } },
        quincaillerie: {
          select: {
            nomEntreprise: true,
            utilisateur: { select: { nom: true } },
          },
        },
        paiement: true,
      },
    });
    if (!order) throw new NotFoundException('Commande materiel introuvable.');
    if (
      (order.statut !== StatutCommandeMateriel.EN_ATTENTE_PAIEMENT &&
        order.statut !== StatutCommandeMateriel.PARTIELLEMENT_DISPONIBLE) ||
      order.montantMateriel === null
    ) {
      throw new BadRequestException(
        "Cette commande n'est pas disponible pour le paiement.",
      );
    }
    if (order.paiement) {
      if (order.paiement.statut !== StatutPaiement.ECHEC) {
        return this.toView(order.paiement);
      }
      await this.prisma.paiementCommandeMateriel.delete({
        where: { id: order.paiement.id },
      });
    }
    const totalAmount =
      Number(order.montantMateriel) +
      (order.livraisonDemandee ? Number(order.montantLivraison ?? 0) : 0);
    if (order.livraisonDemandee && Number(order.montantLivraison ?? 0) <= 0) {
      throw new BadRequestException(
        'Le devis de livraison doit etre calcule avant le paiement.',
      );
    }
    const payment = await this.prisma.paiementCommandeMateriel.create({
      data: {
        commandeMaterielId: order.id,
        clientId: order.clientId,
        quincaillerieId: order.quincaillerieId,
        montant: totalAmount,
        methode: this.toPrismaMethod(input.method),
        cleIdempotence: idempotencyKey,
        referenceTransaction: `MAT-${randomUUID()}`,
      },
    });
    const storeName =
      order.quincaillerie.nomEntreprise || order.quincaillerie.utilisateur.nom;
    const gatewayResult = await this.gateway.initiatePayment({
      amount: totalAmount,
      currency: 'XOF',
      description: `${order.livraisonDemandee ? 'Materiel et livraison' : 'Materiel'} - ${storeName}`,
      customerName: order.client.nom,
      customerEmail: order.client.email ?? undefined,
      customerPhone: order.client.numeroTelephone,
      callbackUrl: input.callbackUrl,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        materialOrderId: order.id,
        materialOrderPaymentId: payment.id,
      },
      method: PaymentMethod[input.method],
    });
    if (
      !gatewayResult.success ||
      !gatewayResult.gatewayReference ||
      !gatewayResult.paymentUrl
    ) {
      await this.prisma.paiementCommandeMateriel.update({
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
    return this.toView(
      await this.prisma.paiementCommandeMateriel.update({
        where: { id: payment.id },
        data: {
          referenceFournisseur: gatewayResult.gatewayReference,
          urlPaiement: gatewayResult.paymentUrl,
        },
      }),
    );
  }

  async confirmMock(requestUser: AuthUser, orderId: string) {
    if (
      (this.config.get<string>('PAYMENT_GATEWAY_MODE') ?? 'mock') !== 'mock'
    ) {
      throw new ForbiddenException(
        'La confirmation manuelle est interdite avec la passerelle active.',
      );
    }
    const payment = await this.prisma.paiementCommandeMateriel.findFirst({
      where: { commandeMaterielId: orderId, clientId: requestUser.sub },
    });
    if (!payment) throw new NotFoundException('Paiement materiel introuvable.');
    return this.complete(
      payment.referenceFournisseur ?? payment.referenceTransaction,
    );
  }

  async processGatewayStatus(
    gatewayReference: string,
    status: string,
  ): Promise<boolean> {
    const payment = await this.prisma.paiementCommandeMateriel.findFirst({
      where: { referenceFournisseur: gatewayReference },
    });
    if (!payment) return false;
    const normalized = status.toLowerCase();
    if (['completed', 'success', 'succeeded', 'paid'].includes(normalized)) {
      await this.complete(gatewayReference);
    } else if (['failed', 'cancelled', 'canceled'].includes(normalized)) {
      await this.prisma.paiementCommandeMateriel.updateMany({
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
    const payment = await this.prisma.paiementCommandeMateriel.findFirst({
      where: {
        OR: [
          { referenceFournisseur: reference },
          { referenceTransaction: reference },
        ],
      },
      include: {
        commandeMateriel: true,
        quincaillerie: {
          select: {
            nomEntreprise: true,
            utilisateur: { select: { id: true, nom: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Paiement materiel introuvable.');
    if (payment.statut === StatutPaiement.SUCCES) return this.toView(payment);

    const completed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paiementCommandeMateriel.updateMany({
        where: { id: payment.id, statut: StatutPaiement.EN_ATTENTE },
        data: {
          statut: StatutPaiement.SUCCES,
          traiteLe: new Date(),
          erreur: null,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.paiementCommandeMateriel.findUniqueOrThrow({
          where: { id: payment.id },
        });
        if (current.statut !== StatutPaiement.SUCCES) {
          throw new ConflictException(
            'Ce paiement ne peut plus etre confirme.',
          );
        }
        return current;
      }
      const orderClaimed = await tx.commandeMateriel.updateMany({
        where: {
          id: payment.commandeMaterielId,
          statut: {
            in: [
              StatutCommandeMateriel.EN_ATTENTE_PAIEMENT,
              StatutCommandeMateriel.PARTIELLEMENT_DISPONIBLE,
            ],
          },
        },
        data: {
          statut: payment.commandeMateriel.livraisonDemandee
            ? StatutCommandeMateriel.EN_ATTENTE_TRANSPORTEUR
            : StatutCommandeMateriel.PAYEE_QUINCAILLERIE,
          payeeLe: new Date(),
        },
      });
      if (orderClaimed.count !== 1) {
        throw new ConflictException(
          "La commande n'est plus en attente de paiement.",
        );
      }
      const store = await tx.profilProfessionnel.update({
        where: { id: payment.quincaillerieId },
        data: {
          soldePortefeuille: {
            increment: payment.commandeMateriel.montantMateriel!,
          },
        },
        select: { soldePortefeuille: true },
      });
      await tx.transactionPortefeuille.create({
        data: {
          profilProfessionnelId: payment.quincaillerieId,
          type: TypeTransactionPortefeuille.CREDIT_QUINCAILLERIE,
          montant: payment.commandeMateriel.montantMateriel!,
          soldeApres: store.soldePortefeuille,
          description: `Paiement materiel commande ${payment.commandeMaterielId}`,
          reference: `MATERIAL-PAYMENT-${payment.id}`,
        },
      });
      return tx.paiementCommandeMateriel.findUniqueOrThrow({
        where: { id: payment.id },
      });
    });

    await Promise.all([
      this.notifications.createInAppNotification({
        userId: payment.clientId,
        type: NOTIFICATION_TYPES.PAIEMENT_CONFIRME,
        title: 'Paiement du materiel confirme',
        body: payment.commandeMateriel.livraisonDemandee
          ? 'Le paiement incluant la livraison est confirme. Nous recherchons maintenant un livreur.'
          : 'Le paiement est confirme. Votre materiel sera a retirer en quincaillerie.',
        data: {
          materialOrderId: payment.commandeMaterielId,
          route: `/material-orders/${payment.commandeMaterielId}`,
        },
      }),
      this.notifications.createInAppNotification({
        userId: payment.quincaillerie.utilisateur.id,
        type: NOTIFICATION_TYPES.PAIEMENT_CONFIRME,
        title: 'Paiement materiel recu',
        body: `Le paiement de ${Number(payment.commandeMateriel.montantMateriel).toLocaleString('fr-FR')} FCFA est confirme.`,
        data: {
          materialOrderId: payment.commandeMaterielId,
          route: `/material-orders/${payment.commandeMaterielId}`,
        },
      }),
    ]);
    if (payment.commandeMateriel.livraisonDemandee) {
      await this.notifyNearbyCouriers(payment.commandeMaterielId);
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
          store.localisation
        ) / 1000 AS "distanceKm"
      FROM material_orders orders
      INNER JOIN professional_profiles store ON store.id = orders.hardware_store_id
      INNER JOIN professional_profiles p ON p.id <> store.id
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN services service ON service.professional_id = p.id
      LEFT JOIN professional_presence presence ON presence.professional_id = p.id
      WHERE orders.id = ${orderId}::uuid
        AND orders.delivery_requested = true
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
      ORDER BY "distanceKm" ASC
      LIMIT 30
    `);
    await Promise.all(
      couriers.map((courier) =>
        this.notifications.createInAppNotification({
          userId: courier.userId,
          type: NOTIFICATION_TYPES.NOUVELLE_RESERVATION,
          title: 'Livraison de materiel disponible',
          body: `Une livraison est disponible a ${Number(courier.distanceKm).toFixed(1)} km. Acceptez-la pour recuperer le materiel en quincaillerie.`,
          data: {
            materialOrderId: orderId,
            route: `/material-orders/${orderId}/delivery-offer`,
          },
        }),
      ),
    );
  }

  private toPrismaMethod(method: MaterialPaymentMethod): MethodePaiement {
    return method === 'CARD' ? MethodePaiement.CARTE : MethodePaiement[method];
  }

  private toView(payment: {
    id: string;
    commandeMaterielId: string;
    montant: Prisma.Decimal;
    methode: MethodePaiement;
    statut: StatutPaiement;
    referenceTransaction: string;
    referenceFournisseur: string | null;
    urlPaiement: string | null;
    traiteLe: Date | null;
  }) {
    return {
      id: payment.id,
      materialOrderId: payment.commandeMaterielId,
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
