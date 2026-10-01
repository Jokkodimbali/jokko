import { NotFoundException } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';
import {
  type InvoiceTemplateService,
  DEFAULT_INVOICE_TEMPLATE,
} from './invoice-template.service';

describe('InvoicesService', () => {
  const prisma = {
    reservation: { findUnique: jest.fn() },
    commandePharmacie: { findUnique: jest.fn() },
    commandeMateriel: { findUnique: jest.fn() },
  };
  const templates = {
    get: jest.fn().mockResolvedValue(DEFAULT_INVOICE_TEMPLATE),
  };
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    templates as unknown as InvoiceTemplateService,
  );
  const user = { sub: 'client', role: RoleUtilisateur.CLIENT, phoneNumber: '' };
  const person = {
    nom: 'Personne',
    numeroTelephone: '+221770000000',
    adresse: 'Dakar',
  };
  const merchant = {
    utilisateurId: 'provider',
    nomEntreprise: 'Entreprise',
    ville: 'Dakar',
    utilisateur: person,
  };
  const booking = () => ({
    id: 'booking',
    clientId: 'client',
    creeLe: new Date('2026-09-30T10:00:00Z'),
    dateHeure: new Date('2026-10-01T10:00:00Z'),
    adresseClient: 'Lieu réel',
    prixConvenu: 12000,
    dureeMinutes: 60,
    client: person,
    professionnel: merchant,
    service: {
      nom: 'Consultation',
      prix: 15000,
      modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
      categorie: { nom: 'Médecine' },
    },
    paiement: {
      montant: 10000,
      montantCommission: 500,
      methode: 'WAVE',
      statut: 'SUCCES',
      processedAt: new Date('2026-09-30T11:00:00Z'),
      creeLe: new Date('2026-09-30T10:00:00Z'),
    },
  });
  const order = () => ({
    id: 'order',
    clientId: 'client',
    pharmacie: merchant,
    quincaillerie: merchant,
    client: person,
    creeLe: new Date('2026-09-30T10:00:00Z'),
    montantMedicaments: 6000,
    montantMateriel: 6000,
    livraisonDemandee: true,
    montantLivraison: 2000,
    adresseLivraison: 'Destination réelle',
    detailsMedicaments: [{ name: 'Produit', price: 6000, isAvailable: true }],
    detailsMateriel: [
      { name: 'Article', unitPrice: 2000, quantity: 3, isAvailable: true },
    ],
    paiement: {
      montant: 8000,
      statut: 'SUCCES',
      methode: 'WAVE',
      traiteLe: null,
      creeLe: new Date('2026-09-30T10:00:00Z'),
    },
    reservationLivraison: { professionnel: { utilisateurId: 'courier' } },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.reservation.findUnique.mockResolvedValue(booking());
    prisma.commandePharmacie.findUnique.mockResolvedValue(order());
    prisma.commandeMateriel.findUnique.mockResolvedValue(order());
  });

  it('uses the charged total without adding the included commission', async () => {
    const invoice = await service.reservation(user, 'booking');
    expect(invoice.total).toBe(10000);
    expect(invoice.includedFees).toBe(500);
    expect(invoice.items[0].amount).toBe(10000);
    expect(invoice.paymentStatus).toBe('SUCCES');
    expect(invoice.template).toBe(DEFAULT_INVOICE_TEMPLATE);
  });

  it('keeps reference and issue date stable across repeated downloads', async () => {
    const first = await service.reservation(user, 'booking');
    const second = await service.reservation(user, 'booking');
    expect(first.reference).toBe(second.reference);
    expect(first.issuedAt).toBe('2026-09-30T11:00:00.000Z');
    expect(first.issuedAt).toBe(second.issuedAt);
  });

  it('never labels an unpaid booking as paid', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      ...booking(),
      paiement: null,
    });
    const invoice = await service.reservation(user, 'booking');
    expect(invoice.total).toBe(12000);
    expect(invoice.paymentStatus).toBe('EN_ATTENTE');
    expect(invoice.includedFees).toBeNull();
  });

  it('rejects unrelated users before loading the template', async () => {
    await expect(
      service.reservation({ ...user, sub: 'stranger' }, 'booking'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(templates.get).not.toHaveBeenCalled();
  });

  it('allows the actual provider and administrator', async () => {
    await expect(
      service.reservation(
        { ...user, sub: 'provider', role: RoleUtilisateur.PRESTATAIRE },
        'booking',
      ),
    ).resolves.toBeDefined();
    await expect(
      service.reservation(
        { ...user, sub: 'admin', role: RoleUtilisateur.ADMIN },
        'booking',
      ),
    ).resolves.toBeDefined();
  });

  it.each(['MEDICAMENTS', 'MATERIEL'] as const)(
    'shares template and stored payment for %s',
    async (kind) => {
      const invoice = await service.order(user, kind, 'order');
      expect(invoice.total).toBe(8000);
      expect(
        invoice.items.reduce((total, item) => total + item.amount, 0),
      ).toBe(8000);
      expect(invoice.template).toBe(DEFAULT_INVOICE_TEMPLATE);
      expect(invoice.location).toBe('Destination réelle');
      await expect(
        service.order({ ...user, sub: 'courier' }, kind, 'order'),
      ).resolves.toBeDefined();
      await expect(
        service.order({ ...user, sub: 'stranger' }, kind, 'order'),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('shows the stored pickup and dropoff for a parcel', async () => {
    const data = booking();
    data.service.modeDeplacement = 'TRANSPORT_COLIS';
    prisma.reservation.findUnique.mockResolvedValue({
      ...data,
      notes:
        'Type de livraison: Colis. Expediteur: Awa - +221771234567. Depart colis: Dakar Centre. Destinataire: Moussa - +221781234567. Arrivee destinataire: Thiès Gare.',
    });
    const invoice = await service.reservation(user, 'booking');
    expect(invoice.parcel).toEqual({
      pickup: { name: 'Awa', phone: '+221771234567', address: 'Dakar Centre' },
      dropoff: {
        name: 'Moussa',
        phone: '+221781234567',
        address: 'Thiès Gare',
      },
    });
  });

  it('uses the provider address when the client travels', async () => {
    const data = booking();
    data.service.modeDeplacement = 'CLIENT_SE_DEPLACE';
    prisma.reservation.findUnique.mockResolvedValue(data);
    expect((await service.reservation(user, 'booking')).location).toBe('Dakar');
  });
});
