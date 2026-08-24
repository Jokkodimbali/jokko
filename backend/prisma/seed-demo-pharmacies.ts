import 'dotenv/config';
import { PrismaClient, RoleUtilisateur, StatutKyc } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis.');

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 8_000,
  idleTimeoutMillis: 5_000,
  allowExitOnIdle: true,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'pharmacie123';
const DEMO_PHARMACIES = [
  {
    phone: '+221780000101',
    email: 'pharmacie.corniche.demo@jokko.sn',
    name: 'Pharmacie de la Corniche',
    address: 'Corniche Ouest, Dakar',
    city: 'Dakar',
    latitude: 14.6977,
    longitude: -17.4661,
    rating: 4.2,
    totalReviews: 18,
  },
  {
    phone: '+221780000102',
    email: 'pharmacie.mermoz.demo@jokko.sn',
    name: 'Pharmacie Mermoz',
    address: 'Mermoz Sacré-Cœur, Dakar',
    city: 'Dakar',
    latitude: 14.7062,
    longitude: -17.4758,
    rating: 5,
    totalReviews: 31,
  },
  {
    phone: '+221780000103',
    email: 'pharmacie.pointe.demo@jokko.sn',
    name: 'Pharmacie du Point E',
    address: 'Point E, Dakar',
    city: 'Dakar',
    latitude: 14.6939,
    longitude: -17.4552,
    rating: 4.7,
    totalReviews: 24,
  },
  {
    phone: '+221780000104',
    email: 'pharmacie.liberte6.demo@jokko.sn',
    name: 'Pharmacie Liberté 6',
    address: 'Liberté 6 Extension, Dakar',
    city: 'Dakar',
    latitude: 14.7222,
    longitude: -17.4558,
    rating: 4.4,
    totalReviews: 15,
  },
] as const;

async function seedDemoPharmacies(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  for (const pharmacy of DEMO_PHARMACIES) {
    const user = await prisma.utilisateur.upsert({
      where: { numeroTelephone: pharmacy.phone },
      update: {
        nom: pharmacy.name,
        email: pharmacy.email,
        adresse: pharmacy.address,
        role: RoleUtilisateur.PRESTATAIRE,
        motDePasseHash: passwordHash,
        estActif: true,
      },
      create: {
        numeroTelephone: pharmacy.phone,
        nom: pharmacy.name,
        email: pharmacy.email,
        adresse: pharmacy.address,
        role: RoleUtilisateur.PRESTATAIRE,
        motDePasseHash: passwordHash,
        estActif: true,
      },
    });

    const profile = await prisma.profilProfessionnel.upsert({
      where: { utilisateurId: user.id },
      update: {
        nomEntreprise: pharmacy.name,
        ville: pharmacy.city,
        estPharmacie: true,
        statutKyc: StatutKyc.VERIFIE,
        noteGlobale: pharmacy.rating,
        nombreAvis: pharmacy.totalReviews,
      },
      create: {
        utilisateurId: user.id,
        nomEntreprise: pharmacy.name,
        ville: pharmacy.city,
        estPharmacie: true,
        statutKyc: StatutKyc.VERIFIE,
        noteGlobale: pharmacy.rating,
        nombreAvis: pharmacy.totalReviews,
      },
    });

    await prisma.$executeRaw`
      UPDATE professional_profiles
      SET localisation = ST_SetSRID(
        ST_MakePoint(${pharmacy.longitude}, ${pharmacy.latitude}),
        4326
      )::geography
      WHERE id = ${profile.id}::uuid
    `;
  }

  const nearby = await prisma.$queryRaw<
    Array<{ name: string; distanceKm: number }>
  >`
    SELECT COALESCE(p.company_name, u.name) AS name,
      ST_Distance(
        p.localisation,
        ST_SetSRID(ST_MakePoint(-17.4677, 14.7167), 4326)::geography
      ) / 1000 AS "distanceKm"
    FROM professional_profiles p
    INNER JOIN users u ON u.id = p.user_id
    WHERE p.is_pharmacy = true
      AND p.kyc_status = 'VERIFIE'
      AND u.is_active = true
      AND p.localisation IS NOT NULL
      AND u.phone_number LIKE '+2217800001%'
    ORDER BY "distanceKm" ASC
  `;

  console.table(
    nearby.map((pharmacy) => ({
      pharmacie: pharmacy.name,
      distanceKm: Number(pharmacy.distanceKm).toFixed(2),
    })),
  );
  console.log(`Mot de passe des comptes pharmacie de démonstration : ${DEMO_PASSWORD}`);
}

seedDemoPharmacies()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
