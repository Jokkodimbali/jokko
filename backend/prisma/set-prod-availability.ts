import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const PRO_D_PHONE = '+221786441502';

const WEEKLY_AVAILABILITIES = [
  { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' },
  { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' },
  { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' },
  { dayOfWeek: 4, startTime: '08:00', endTime: '18:00' },
  { dayOfWeek: 5, startTime: '08:00', endTime: '18:00' },
  { dayOfWeek: 6, startTime: '08:00', endTime: '13:00' },
];

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL est requis pour definir les disponibilites de Pro D.');
}

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function toTimeDate(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

async function main(): Promise<void> {
  const user = await prisma.utilisateur.findUnique({
    where: { numeroTelephone: PRO_D_PHONE },
    select: {
      id: true,
      numeroTelephone: true,
      nom: true,
      profilProfessionnel: {
        select: {
          id: true,
          disponibilites: {
            where: { estActive: true },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!user?.profilProfessionnel) {
    throw new Error(
      `Aucun profil professionnel trouve pour Pro D (${PRO_D_PHONE}). Connecte/cree ce compte prestataire avant de lancer ce script.`,
    );
  }

  const professionalId = user.profilProfessionnel.id;

  await prisma.$transaction([
    prisma.disponibilite.updateMany({
      where: {
        profilProfessionnelId: professionalId,
        estActive: true,
      },
      data: { estActive: false },
    }),
    prisma.disponibilite.createMany({
      data: WEEKLY_AVAILABILITIES.map((availability) => ({
        profilProfessionnelId: professionalId,
        jourSemaine: availability.dayOfWeek,
        heureDebut: toTimeDate(availability.startTime),
        heureFin: toTimeDate(availability.endTime),
        estActive: true,
      })),
    }),
  ]);

  const availabilities = await prisma.disponibilite.findMany({
    where: {
      profilProfessionnelId: professionalId,
      estActive: true,
    },
    orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
    select: {
      jourSemaine: true,
      heureDebut: true,
      heureFin: true,
    },
  });

  console.table(
    availabilities.map((availability) => ({
      jourSemaine: availability.jourSemaine,
      debut: availability.heureDebut.toISOString().slice(11, 16),
      fin: availability.heureFin.toISOString().slice(11, 16),
    })),
  );

  console.log(
    `Disponibilites de ${user.nom} (${user.numeroTelephone}) configurees avec succes.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
