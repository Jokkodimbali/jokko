import 'dotenv/config';
import {
  EscrowStatus,
  MethodePaiement,
  PrismaClient,
  RoleUtilisateur,
  StatutKyc,
  StatutPaiement,
  StatutReservation,
  StatutRetrait,
  TypePrix,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { TECHNICAL_MESSAGES } from '../src/core/messages/technical-message.catalog';
import { PAYMENT_NOTIFICATION_MESSAGES } from '../src/core/messages/payment-notification.messages';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(TECHNICAL_MESSAGES.SEED_DATABASE_URL_MISSING);
}

const adapter = new PrismaPg(
  new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
  }),
);

const prisma = new PrismaClient({ adapter });

const SEED_IDS = {
  santeCategory: '11111111-1111-4111-8111-111111111111',
  plomberieCategory: '22222222-2222-4222-8222-222222222222',
  professionalProfile: '33333333-3333-4333-8333-333333333333',
  serviceConsultation: '44444444-4444-4444-8444-444444444444',
  reservationPaid: '55555555-5555-4555-8555-555555555555',
  reservationConfirmed: '66666666-6666-4666-8666-666666666666',
  conversationDemo: '99999999-9999-4999-8999-999999999999',
  paymentPaid: '77777777-7777-4777-8777-777777777777',
  withdrawal: '88888888-8888-4888-8888-888888888888',
};

const SEED_USERS = {
  admin: {
    phone: process.env.SEED_ADMIN_PHONE || '+221771234567',
    name: 'Admin mamadou dia',
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    role: RoleUtilisateur.ADMIN,
  },
  client: {
    phone: '+221772345678',
    name: 'Client jokko',
    password: 'client123',
    role: RoleUtilisateur.CLIENT,
  },
  professional: {
    phone: '+221773456789',
    name: 'Docteur Jokko',
    password: 'prof12345',
    role: RoleUtilisateur.PRESTATAIRE,
  },
};

async function upsertUser(input: (typeof SEED_USERS)[keyof typeof SEED_USERS]) {
  const passwordHash = await argon2.hash(input.password);
  return prisma.utilisateur.upsert({
    where: { numeroTelephone: input.phone },
    update: {
      nom: input.name,
      role: input.role,
      motDePasseHash: passwordHash,
      estActif: true,
    },
    create: {
      numeroTelephone: input.phone,
      nom: input.name,
      role: input.role,
      motDePasseHash: passwordHash,
      estActif: true,
    },
  });
}

export async function runSeed() {
  const admin = await upsertUser(SEED_USERS.admin);
  const client = await upsertUser(SEED_USERS.client);
  const professionalUser = await upsertUser(SEED_USERS.professional);

  await prisma.notification.deleteMany({
    where: {
      utilisateurId: { in: [client.id, professionalUser.id, admin.id] },
    },
  });

  const santeCategory = await prisma.categorie.upsert({
    where: { nom: 'Sante & Medecine' },
    update: { nom: 'Sante & Medecine', ordreTri: 1, estActive: true },
    create: {
      id: SEED_IDS.santeCategory,
      nom: 'Sante & Medecine',
      ordreTri: 1,
      estActive: true,
    },
  });

  await prisma.categorie.upsert({
    where: { nom: 'Plomberie & Sanitaire' },
    update: { nom: 'Plomberie & Sanitaire', ordreTri: 2, estActive: true },
    create: {
      id: SEED_IDS.plomberieCategory,
      nom: 'Plomberie & Sanitaire',
      ordreTri: 2,
      estActive: true,
    },
  });

  const professionalProfile = await prisma.profilProfessionnel.upsert({
    where: { utilisateurId: professionalUser.id },
    update: {
      biographie: 'Professionnel demo verifie pour tester les paiements.',
      nomEntreprise: 'Cabinet Demo Jokko',
      statutKyc: StatutKyc.VERIFIE,
      ville: 'Dakar',
      urlPieceIdentiteRecto: 'https://example.com/cni-recto.jpg',
      urlPieceIdentiteVerso: 'https://example.com/cni-verso.jpg',
    },
    create: {
      id: SEED_IDS.professionalProfile,
      utilisateurId: professionalUser.id,
      biographie: 'Professionnel demo verifie pour tester les paiements.',
      nomEntreprise: 'Cabinet Demo Jokko',
      statutKyc: StatutKyc.VERIFIE,
      ville: 'Dakar',
      urlPieceIdentiteRecto: 'https://example.com/cni-recto.jpg',
      urlPieceIdentiteVerso: 'https://example.com/cni-verso.jpg',
    },
  });

  const service = await prisma.service.upsert({
    where: { id: SEED_IDS.serviceConsultation },
    update: {
      profilProfessionnelId: professionalProfile.id,
      categorieId: santeCategory.id,
      nom: 'Consultation medicale demo',
      description: 'Service demo pour tester reservation puis paiement escrow.',
      prix: 10000,
      typePrix: TypePrix.FIXE,
      estDisponible: true,
    },
    create: {
      id: SEED_IDS.serviceConsultation,
      profilProfessionnelId: professionalProfile.id,
      categorieId: santeCategory.id,
      nom: 'Consultation medicale demo',
      description: 'Service demo pour tester reservation puis paiement escrow.',
      prix: 10000,
      typePrix: TypePrix.FIXE,
      estDisponible: true,
    },
  });

  await prisma.reservation.upsert({
    where: { id: SEED_IDS.reservationConfirmed },
    update: {
      clientId: client.id,
      professionnelId: professionalProfile.id,
      serviceId: service.id,
      dateHeure: new Date(Date.now() + 48 * 60 * 60 * 1000),
      adresseClient: 'Dakar Plateau',
      dureeMinutes: 60,
      statut: StatutReservation.CONFIRMEE,
      prixConvenu: 10000,
      notes: 'Reservation demo prete pour initier un nouveau paiement.',
    },
    create: {
      id: SEED_IDS.reservationConfirmed,
      clientId: client.id,
      professionnelId: professionalProfile.id,
      serviceId: service.id,
      dateHeure: new Date(Date.now() + 48 * 60 * 60 * 1000),
      adresseClient: 'Dakar Plateau',
      dureeMinutes: 60,
      statut: StatutReservation.CONFIRMEE,
      prixConvenu: 10000,
      notes: 'Reservation demo prete pour initier un nouveau paiement.',
    },
  });

  await prisma.reservation.upsert({
    where: { id: SEED_IDS.reservationPaid },
    update: {
      clientId: client.id,
      professionnelId: professionalProfile.id,
      serviceId: service.id,
      dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000),
      adresseClient: 'Dakar Almadies',
      dureeMinutes: 60,
      statut: StatutReservation.PAYEE_SEQUESTRE,
      prixConvenu: 10000,
      notes: 'Reservation demo deja payee en escrow.',
    },
    create: {
      id: SEED_IDS.reservationPaid,
      clientId: client.id,
      professionnelId: professionalProfile.id,
      serviceId: service.id,
      dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000),
      adresseClient: 'Dakar Almadies',
      dureeMinutes: 60,
      statut: StatutReservation.PAYEE_SEQUESTRE,
      prixConvenu: 10000,
      notes: 'Reservation demo deja payee en escrow.',
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: { reservationId: SEED_IDS.reservationConfirmed },
    update: {
      clientId: client.id,
      prestataireId: professionalUser.id,
      dernierMessageLe: new Date(),
    },
    create: {
      id: SEED_IDS.conversationDemo,
      clientId: client.id,
      prestataireId: professionalUser.id,
      reservationId: SEED_IDS.reservationConfirmed,
      dernierMessageLe: new Date(),
    },
  });

  // Create sample messages
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        expediteurId: client.id,
        contenu:
          "Bonjour Docteur, j'ai reserve une consultation pour demain. Pouvez-vous confirmer l'heure ?",
        creeLe: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        conversationId: conversation.id,
        expediteurId: professionalUser.id,
        contenu:
          'Bonjour ! Oui, votre consultation est bien programmee pour demain a 10h. Je vous attends au cabinet.',
        creeLe: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
      },
      {
        conversationId: conversation.id,
        expediteurId: client.id,
        contenu:
          'Parfait, merci. Dois-je apporter quelque chose en particulier ?',
        creeLe: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      },
      {
        conversationId: conversation.id,
        expediteurId: professionalUser.id,
        contenu:
          "Apportez simplement votre carte d'identite et vos examens medicaux precedents si vous en avez. A demain !",
        creeLe: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
    ],
  });

  const payment = await prisma.paiement.upsert({
    where: { reservationId: SEED_IDS.reservationPaid },
    update: {
      clientId: client.id,
      professionalId: professionalProfile.id,
      montant: 10000,
      montantCommission: 1000,
      montantNet: 9000,
      methode: MethodePaiement.WAVE,
      statut: StatutPaiement.SUCCES,
      escrowStatus: EscrowStatus.LOCKED,
      referenceTransaction: 'PAY_SEED_20260421',
      gatewayReference: 'GW_SEED_20260421',
      processedAt: new Date(),
      raisonRemboursement: null,
    },
    create: {
      id: SEED_IDS.paymentPaid,
      reservationId: SEED_IDS.reservationPaid,
      clientId: client.id,
      professionalId: professionalProfile.id,
      montant: 10000,
      montantCommission: 1000,
      montantNet: 9000,
      methode: MethodePaiement.WAVE,
      statut: StatutPaiement.SUCCES,
      escrowStatus: EscrowStatus.LOCKED,
      referenceTransaction: 'PAY_SEED_20260421',
      gatewayReference: 'GW_SEED_20260421',
      processedAt: new Date(),
    },
  });

  await prisma.demandeRetrait.upsert({
    where: { id: SEED_IDS.withdrawal },
    update: {
      profilProfessionnelId: professionalProfile.id,
      montant: 5000,
      methode: MethodePaiement.WAVE,
      statut: StatutRetrait.EN_ATTENTE,
    },
    create: {
      id: SEED_IDS.withdrawal,
      profilProfessionnelId: professionalProfile.id,
      montant: 5000,
      methode: MethodePaiement.WAVE,
      statut: StatutRetrait.EN_ATTENTE,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        utilisateurId: client.id,
        type: 'PAIEMENT_CONFIRME',
        titre: PAYMENT_NOTIFICATION_MESSAGES.CLIENT_ESCROW_CONFIRMED_TITLE,
        corps: PAYMENT_NOTIFICATION_MESSAGES.SEED_CLIENT_ESCROW_CONFIRMED_BODY,
        donnees: {
          reservationId: SEED_IDS.reservationPaid,
          paymentId: payment.id,
          amount: 10000,
          escrowStatus: EscrowStatus.LOCKED,
        },
      },
      {
        utilisateurId: professionalUser.id,
        type: 'PAIEMENT_CONFIRME',
        titre:
          PAYMENT_NOTIFICATION_MESSAGES.PROFESSIONAL_ESCROW_CONFIRMED_TITLE,
        corps:
          PAYMENT_NOTIFICATION_MESSAGES.SEED_PROFESSIONAL_ESCROW_CONFIRMED_BODY,
        donnees: {
          reservationId: SEED_IDS.reservationPaid,
          paymentId: payment.id,
          amount: 10000,
          escrowStatus: EscrowStatus.LOCKED,
        },
      },
    ],
  });
}

export async function disconnectSeedClient(): Promise<void> {
  await prisma.$disconnect();
}

async function main(): Promise<void> {
  await runSeed();
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    })
    .finally(disconnectSeedClient);
}
