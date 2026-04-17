import {
  PrismaClient,
  RoleUtilisateur,
  StatutKyc,
  TypePrix,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TECHNICAL_MESSAGES } from '../src/core/messages/technical-message.catalog';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(TECHNICAL_MESSAGES.SEED_DATABASE_URL_MISSING);
}

const adapter = new PrismaPg(
  new Pool({
    connectionString,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
  }),
);

const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { nom: 'Sante & Medecine', ordreTri: 1 },
  { nom: 'Plomberie', ordreTri: 2 },
];

async function seed() {
  for (const cat of CATEGORIES) {
    await prisma.categorie.upsert({
      where: { nom: cat.nom },
      update: { ordreTri: cat.ordreTri },
      create: cat,
    });
  }

  const adminPhone = process.env.SEED_ADMIN_PHONE || '+221771234567';
  const adminName = 'Super Admin';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const adminHash = await argon2.hash(adminPass);

  const admin = await prisma.utilisateur.upsert({
    where: { numeroTelephone: adminPhone },
    update: { motDePasseHash: adminHash, role: RoleUtilisateur.ADMIN },
    create: {
      numeroTelephone: adminPhone,
      nom: adminName,
      motDePasseHash: adminHash,
      role: RoleUtilisateur.ADMIN,
    },
  });

  const clientPhone = '+221772345678';
  const client = await prisma.utilisateur.upsert({
    where: { numeroTelephone: clientPhone },
    update: {},
    create: {
      numeroTelephone: clientPhone,
      nom: 'Test Client',
      role: RoleUtilisateur.CLIENT,
      motDePasseHash: await argon2.hash('client123'),
    },
  });

  const profPhone = '+221773456789';
  const prof = await prisma.utilisateur.upsert({
    where: { numeroTelephone: profPhone },
    update: {},
    create: {
      numeroTelephone: profPhone,
      nom: 'Test Prof',
      role: RoleUtilisateur.PRESTATAIRE,
      motDePasseHash: await argon2.hash('prof123'),
    },
  });

  const profId = randomUUID();
  await prisma.profilProfessionnel.upsert({
    where: { utilisateurId: prof.id },
    update: {},
    create: {
      id: profId,
      utilisateurId: prof.id,
      statutKyc: StatutKyc.VERIFIE,
      ville: 'Dakar',
      urlPieceIdentiteRecto: null,
    },
  });

  const category = await prisma.categorie.findFirst({
    where: { nom: 'Sante & Medecine' },
  });
  if (!category) {
    throw new Error(TECHNICAL_MESSAGES.SEED_CATEGORY_NOT_FOUND);
  }

  const serviceFixeId = randomUUID();
  await prisma.service.create({
    data: {
      id: serviceFixeId,
      profilProfessionnelId: profId,
      categorieId: category.id,
      nom: 'Consultation FIXE',
      description: 'Consultation medicale fixe',
      prix: 5000,
      typePrix: TypePrix.FIXE,
    },
  });

  const serviceNegId = randomUUID();
  await prisma.service.create({
    data: {
      id: serviceNegId,
      profilProfessionnelId: profId,
      categorieId: category.id,
      nom: 'Consultation NEGOCIABLE',
      description: 'Consultation negociable',
      prix: 0,
      typePrix: TypePrix.NEGOCIABLE,
    },
  });

  await prisma.reservation.create({
    data: {
      id: randomUUID(),
      clientId: client.id,
      professionnelId: profId,
      serviceId: serviceFixeId,
      dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000),
      dureeMinutes: 60,
      statut: 'EN_ATTENTE',
      adresseClient: 'Dakar',
    },
  });

  console.log(TECHNICAL_MESSAGES.SEED_SUCCESS);

  void admin;
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
