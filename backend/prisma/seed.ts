import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleUtilisateur } from '@prisma/client';
import * as argon2 from 'argon2';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
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
  { nom: 'Plomberie & Sanitaire', ordreTri: 2 },
  { nom: 'Electricite', ordreTri: 3 },
  { nom: 'Mecanique Automobile', ordreTri: 4 },
  { nom: 'Informatique & Tech', ordreTri: 5 },
  { nom: 'Cuisine & Traiteur', ordreTri: 6 },
  { nom: 'Beaute & Bien-etre', ordreTri: 7 },
  { nom: 'BTP & Renovation', ordreTri: 8 },
  { nom: 'Menage & Services', ordreTri: 9 },
  { nom: 'Cours & Formation', ordreTri: 10 },
  { nom: 'Transport & Livraison', ordreTri: 11 },
  { nom: 'Photo & Evenement', ordreTri: 12 },
];

async function seedCategories(): Promise<void> {
  for (const category of CATEGORIES) {
    await prisma.categorie.upsert({
      where: { nom: category.nom },
      update: {
        ordreTri: category.ordreTri,
        estActive: true,
      },
      create: {
        nom: category.nom,
        ordreTri: category.ordreTri,
        estActive: true,
      },
    });
  }
}

async function seedAdminFromEnv(): Promise<void> {
  const adminPhone = process.env.SEED_ADMIN_PHONE?.trim();
  const adminName = process.env.SEED_ADMIN_NAME?.trim() ?? 'Admin Jokko';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!adminPhone || !adminPassword) {
    return;
  }

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 3,
    parallelism: 1,
  });

  await prisma.utilisateur.upsert({
    where: { numeroTelephone: adminPhone },
    update: {
      nom: adminName,
      motDePasseHash: passwordHash,
      role: RoleUtilisateur.ADMIN,
      estActif: true,
    },
    create: {
      numeroTelephone: adminPhone,
      nom: adminName,
      motDePasseHash: passwordHash,
      role: RoleUtilisateur.ADMIN,
      estActif: true,
    },
  });
}

async function main(): Promise<void> {
  await seedCategories();
  await seedAdminFromEnv();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Seed error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
