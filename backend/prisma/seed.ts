import 'dotenv/config';
import { PrismaClient, RoleUtilisateur } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { TECHNICAL_MESSAGES } from '../src/core/messages/technical-message.catalog';

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
    name: 'Prestataire jokko',
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
      fournisseurOauth: null,
      identifiantOauth: null,
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
  await upsertUser(SEED_USERS.admin);
  await upsertUser(SEED_USERS.client);
  await upsertUser(SEED_USERS.professional);
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
