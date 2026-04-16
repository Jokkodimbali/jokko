import { PrismaClient, RoleUtilisateur, StatutKyc, TypePrix } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
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
  { nom: 'Santé & Médecine', ordreTri: 1 },
  { nom: 'Plomberie', ordreTri: 2 },
];

async function seed() {
  // Categories
  for (const cat of CATEGORIES) {
    await prisma.categorie.upsert({
      where: { nom: cat.nom },
      update: { ordreTri: cat.ordreTri },
      create: cat,
    });
  }

  // Admin
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

  // Client
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

  // Professional
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

  // Prof Profile
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

  // Category ID
  const category = await prisma.categorie.findFirst({ where: { nom: 'Santé & Médecine' } });
  if (!category) throw new Error('Category not found');

  // Services
  const serviceFixeId = randomUUID();
  await prisma.service.create({
    data: {
      id: serviceFixeId,
      profilProfessionnelId: profId,
      categorieId: category.id,
      nom: 'Consultation FIXE',
      description: 'Consultation médicale fixe',
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
      description: 'Consultation négociable',
      prix: 0,
      typePrix: TypePrix.NEGOCIABLE,
    },
  });

  // Test Reservation
  await prisma.reservation.create({
    data: {
      id: randomUUID(),
      clientId: client.id,
      professionnelId: profId,
      serviceId: serviceFixeId,
      dateHeure: new Date(Date.now() + 24*60*60*1000),
      dureeMinutes: 60,
      statut: 'EN_ATTENTE',
    },
  });

  console.log('✅ Seed complete: Users, Prof, Services, Reservation créée!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

