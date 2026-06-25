import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

try {
  const rows = await prisma.reservation.findMany({
    where: { notes: { contains: 'demo' } },
    select: {
      id: true,
      statut: true,
      dateHeure: true,
      adresseClient: true,
      client: { select: { numeroTelephone: true, nom: true } },
      professionnel: {
        select: {
          nomEntreprise: true,
          utilisateur: {
            select: { numeroTelephone: true, nom: true, role: true },
          },
        },
      },
      service: {
        select: {
          nom: true,
          modeDeplacement: true,
          prix: true,
          categorie: { select: { nom: true } },
        },
      },
    },
    orderBy: { dateHeure: 'asc' },
  });

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
