import 'dotenv/config';
import {
  PrismaClient,
  RoleUtilisateur,
  StatutKyc,
  TypePrix,
} from '@prisma/client';
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

const DEMO_PASSWORD = 'quincaillerie123';
const DEMO_STORES = [
  {
    phone: '+221780000201',
    email: 'quincaillerie.mermoz.demo@jokko.sn',
    name: 'Quincaillerie Mermoz',
    address: 'Mermoz Sacre-Coeur, Dakar',
    city: 'Dakar',
    latitude: 14.7092,
    longitude: -17.4751,
    rating: 4.8,
    totalReviews: 26,
  },
  {
    phone: '+221780000202',
    email: 'quincaillerie.liberte.demo@jokko.sn',
    name: 'Quincaillerie Liberte 6',
    address: 'Liberte 6 Extension, Dakar',
    city: 'Dakar',
    latitude: 14.7215,
    longitude: -17.4564,
    rating: 4.6,
    totalReviews: 19,
  },
  {
    phone: '+221780000203',
    email: 'quincaillerie.point-e.demo@jokko.sn',
    name: 'Quincaillerie du Point E',
    address: 'Point E, Dakar',
    city: 'Dakar',
    latitude: 14.6951,
    longitude: -17.4544,
    rating: 4.7,
    totalReviews: 34,
  },
  {
    phone: '+221780000204',
    email: 'quincaillerie.ouakam.demo@jokko.sn',
    name: 'Quincaillerie Ouakam',
    address: 'Ouakam, Dakar',
    city: 'Dakar',
    latitude: 14.7234,
    longitude: -17.4891,
    rating: 4.5,
    totalReviews: 15,
  },
] as const;

async function ensureCatalog() {
  const category = await prisma.categorie.upsert({
    where: { nom: 'Quincaillerie et materiaux' },
    update: { estActive: true },
    create: {
      nom: 'Quincaillerie et materiaux',
      ordreTri: 35,
      tauxCommission: 10,
      estActive: true,
    },
  });
  const subcategory = await prisma.sousCategorieService.upsert({
    where: { nom: 'Quincaillerie' },
    update: { estActive: true },
    create: {
      nom: 'Quincaillerie',
      description: 'Vente de materiaux, fournitures, pieces et outillage.',
      ordreTri: 1,
      estActive: true,
    },
  });
  await prisma.categorieSousCategorie.upsert({
    where: {
      categorieId_sousCategorieId: {
        categorieId: category.id,
        sousCategorieId: subcategory.id,
      },
    },
    update: { ordreTri: 1 },
    create: {
      categorieId: category.id,
      sousCategorieId: subcategory.id,
      ordreTri: 1,
    },
  });
  return { category, subcategory };
}

async function seedDemoHardwareStores(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const { category, subcategory } = await ensureCatalog();

  for (const store of DEMO_STORES) {
    const user = await prisma.utilisateur.upsert({
      where: { numeroTelephone: store.phone },
      update: {
        nom: store.name,
        email: store.email,
        adresse: store.address,
        role: RoleUtilisateur.PRESTATAIRE,
        motDePasseHash: passwordHash,
        estActif: true,
      },
      create: {
        numeroTelephone: store.phone,
        nom: store.name,
        email: store.email,
        adresse: store.address,
        role: RoleUtilisateur.PRESTATAIRE,
        motDePasseHash: passwordHash,
        estActif: true,
      },
    });
    const profile = await prisma.profilProfessionnel.upsert({
      where: { utilisateurId: user.id },
      update: {
        nomEntreprise: store.name,
        ville: store.city,
        estQuincaillerie: true,
        statutKyc: StatutKyc.VERIFIE,
        noteGlobale: store.rating,
        nombreAvis: store.totalReviews,
      },
      create: {
        utilisateurId: user.id,
        nomEntreprise: store.name,
        ville: store.city,
        estQuincaillerie: true,
        statutKyc: StatutKyc.VERIFIE,
        noteGlobale: store.rating,
        nombreAvis: store.totalReviews,
      },
    });
    await prisma.specialiteProfessionnelle.upsert({
      where: {
        profilProfessionnelId_categorieId_sousCategorieId: {
          profilProfessionnelId: profile.id,
          categorieId: category.id,
          sousCategorieId: subcategory.id,
        },
      },
      update: {},
      create: {
        profilProfessionnelId: profile.id,
        categorieId: category.id,
        sousCategorieId: subcategory.id,
      },
    });
    const service = await prisma.service.findFirst({
      where: { profilProfessionnelId: profile.id, categorieId: category.id },
      select: { id: true },
    });
    if (service) {
      await prisma.service.update({
        where: { id: service.id },
        data: { estDisponible: true },
      });
    } else {
      await prisma.service.create({
        data: {
          profilProfessionnelId: profile.id,
          categorieId: category.id,
          nom: 'Vente de materiel et fournitures',
          description:
            'Verification et preparation du materiel necessaire aux prestations Jokko.',
          prix: 0,
          typePrix: TypePrix.NEGOCIABLE,
          dureeMinutes: 30,
          estDisponible: true,
        },
      });
    }
    await prisma.$executeRaw`
      UPDATE professional_profiles
      SET localisation = ST_SetSRID(
        ST_MakePoint(${store.longitude}, ${store.latitude}),
        4326
      )::geography
      WHERE id = ${profile.id}::uuid
    `;
  }

  const seeded = await prisma.utilisateur.findMany({
    where: { numeroTelephone: { startsWith: '+2217800002' } },
    select: { numeroTelephone: true, nom: true },
    orderBy: { numeroTelephone: 'asc' },
  });
  console.warn('Comptes de quincaillerie disponibles :', seeded);
  console.warn(`Mot de passe commun : ${DEMO_PASSWORD}`);
}

seedDemoHardwareStores()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
