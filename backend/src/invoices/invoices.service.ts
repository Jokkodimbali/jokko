import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/security/auth-user.type';
import { extractAppointmentNoteValue } from '../live-tracking/application/services/tracking-parcel-destination.helper';
import { InvoiceTemplateService } from './invoice-template.service';

const personSelect = {
  nom: true,
  numeroTelephone: true,
  adresse: true,
} as const;
const professionalSelect = {
  utilisateurId: true,
  nomEntreprise: true,
  ville: true,
  utilisateur: { select: personSelect },
} as const;
const orderInclude = {
  client: { select: personSelect },
  paiement: true,
  reservationLivraison: {
    select: { professionnel: { select: { utilisateurId: true } } },
  },
} as const;

type Person = { nom: string; numeroTelephone: string; adresse: string | null };

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: InvoiceTemplateService,
  ) {}

  async reservation(user: AuthUser, id: string) {
    const booking = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        dateHeure: true,
        creeLe: true,
        adresseClient: true,
        notes: true,
        prixConvenu: true,
        dureeMinutes: true,
        client: { select: personSelect },
        professionnel: { select: professionalSelect },
        service: {
          select: {
            nom: true,
            prix: true,
            modeDeplacement: true,
            categorie: { select: { nom: true } },
          },
        },
        paiement: {
          select: {
            montant: true,
            montantCommission: true,
            methode: true,
            statut: true,
            processedAt: true,
            creeLe: true,
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Facture introuvable.');
    this.authorize(user, booking.clientId, booking.professionnel.utilisateurId);
    const payment = booking.paiement;
    const total = Number(
      payment?.montant ?? booking.prixConvenu ?? booking.service.prix,
    );
    const professional = booking.professionnel;
    return {
      template: await this.templates.get(),
      reference: this.reference('PRE', id),
      issuedAt: (
        payment?.processedAt ??
        payment?.creeLe ??
        booking.creeLe
      ).toISOString(),
      serviceDate: booking.dateHeure.toISOString(),
      provider: {
        ...this.party(professional.utilisateur),
        name: professional.nomEntreprise || professional.utilisateur.nom,
        subtitle: booking.service.categorie.nom,
      },
      client: this.party(booking.client),
      travelMode: booking.service.modeDeplacement,
      location:
        booking.service.modeDeplacement === 'CLIENT_SE_DEPLACE'
          ? professional.utilisateur.adresse || professional.ville || ''
          : booking.adresseClient,
      parcel:
        booking.service.modeDeplacement === 'TRANSPORT_COLIS'
          ? this.parcelFromNotes(
              booking.notes,
              booking.adresseClient,
              booking.client,
            )
          : null,
      items: [{ name: booking.service.nom, quantity: 1, amount: total }],
      total,
      includedFees: payment ? Number(payment.montantCommission) : null,
      paymentStatus: payment?.statut ?? 'EN_ATTENTE',
      paymentMethod: payment?.methode ?? null,
      durationMinutes: booking.dureeMinutes,
    };
  }

  async order(user: AuthUser, kind: 'MEDICAMENTS' | 'MATERIEL', id: string) {
    const source =
      kind === 'MEDICAMENTS'
        ? await this.prisma.commandePharmacie
            .findUnique({
              where: { id },
              include: {
                ...orderInclude,
                pharmacie: { select: professionalSelect },
              },
            })
            .then(
              (order) =>
                order && {
                  ...order,
                  merchant: order.pharmacie,
                  goodsAmount: order.montantMedicaments,
                  details: order.detailsMedicaments,
                },
            )
        : await this.prisma.commandeMateriel
            .findUnique({
              where: { id },
              include: {
                ...orderInclude,
                quincaillerie: { select: professionalSelect },
              },
            })
            .then(
              (order) =>
                order && {
                  ...order,
                  merchant: order.quincaillerie,
                  goodsAmount: order.montantMateriel,
                  details: order.detailsMateriel,
                },
            );
    if (!source) throw new NotFoundException('Facture introuvable.');
    this.authorize(
      user,
      source.clientId,
      source.merchant.utilisateurId,
      source.reservationLivraison?.professionnel.utilisateurId,
    );
    const payment = source.paiement;
    const goods = Number(source.goodsAmount ?? 0);
    const delivery = source.livraisonDemandee
      ? Number(source.montantLivraison ?? 0)
      : 0;
    const items = this.orderItems(source.details, kind);
    // Incomplete historical item data must not manufacture unit prices.
    if (
      !items.length ||
      Math.abs(items.reduce((sum, item) => sum + item.amount, 0) - goods) > 0.01
    ) {
      items.splice(0, items.length, {
        name: kind === 'MEDICAMENTS' ? 'Médicaments' : 'Matériel',
        quantity: 1,
        amount: goods,
      });
    }
    if (source.livraisonDemandee)
      items.push({ name: 'Livraison', quantity: 1, amount: delivery });
    return {
      template: await this.templates.get(),
      reference: this.reference(kind === 'MEDICAMENTS' ? 'PHA' : 'MAT', id),
      issuedAt: (
        payment?.traiteLe ??
        payment?.creeLe ??
        source.creeLe
      ).toISOString(),
      serviceDate: null,
      provider: {
        ...this.party(source.merchant.utilisateur),
        name: source.merchant.nomEntreprise || source.merchant.utilisateur.nom,
        subtitle: kind === 'MEDICAMENTS' ? 'Pharmacie' : 'Quincaillerie',
      },
      client: this.party(source.client),
      travelMode: source.livraisonDemandee
        ? 'TRANSPORT_COLIS'
        : 'CLIENT_SE_DEPLACE',
      location: source.livraisonDemandee
        ? source.adresseLivraison || ''
        : source.merchant.utilisateur.adresse || source.merchant.ville || '',
      items,
      parcel: source.livraisonDemandee
        ? {
            pickup: {
              ...this.party(source.merchant.utilisateur),
              name:
                source.merchant.nomEntreprise ||
                source.merchant.utilisateur.nom,
            },
            dropoff: {
              ...this.party(source.client),
              address: source.adresseLivraison || source.client.adresse || '',
            },
          }
        : null,
      total: payment ? Number(payment.montant) : goods + delivery,
      includedFees: null,
      paymentStatus: payment?.statut ?? 'EN_ATTENTE',
      paymentMethod: payment?.methode ?? null,
      durationMinutes: null,
    };
  }

  private parcelFromNotes(
    notes: string | null,
    fallbackAddress: string,
    client: Person,
  ) {
    const contact = (key: 'Expediteur' | 'Destinataire') => {
      const value = extractAppointmentNoteValue(notes, key) || '';
      const [name, ...phone] = value.split(/\s+[-–—]\s+/);
      return {
        name: name || client.nom,
        phone: phone.join(' - ') || client.numeroTelephone,
      };
    };
    return {
      pickup: {
        ...contact('Expediteur'),
        address:
          extractAppointmentNoteValue(notes, 'Depart colis') || fallbackAddress,
      },
      dropoff: {
        ...contact('Destinataire'),
        address:
          extractAppointmentNoteValue(notes, 'Arrivee destinataire') ||
          fallbackAddress,
      },
    };
  }

  private authorize(
    user: AuthUser,
    ...participants: Array<string | undefined>
  ) {
    if (user.role !== 'ADMIN' && !participants.includes(user.sub)) {
      throw new NotFoundException('Facture introuvable.');
    }
  }

  private reference(prefix: string, id: string): string {
    return `JD-${prefix}-${id.toUpperCase()}`;
  }

  private party(person: Person) {
    return {
      name: person.nom,
      phone: person.numeroTelephone,
      address: person.adresse || '',
    };
  }

  private orderItems(
    details: Prisma.JsonValue,
    kind: 'MEDICAMENTS' | 'MATERIEL',
  ) {
    if (!Array.isArray(details)) return [];
    return details.flatMap((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        item.isAvailable === false
      )
        return [];
      const quantity = kind === 'MATERIEL' ? Number(item.quantity) : 1;
      const price = Number(kind === 'MATERIEL' ? item.unitPrice : item.price);
      if (
        typeof item.name !== 'string' ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      )
        return [];
      return [{ name: item.name, quantity, amount: price * quantity }];
    });
  }
}
