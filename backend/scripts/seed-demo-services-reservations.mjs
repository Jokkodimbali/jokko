import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing.');
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

const clientPhone = '+221772345678';

const providers = [
  {
    key: 'medecin',
    phone: '+221774111111',
    name: 'Dr Awa Ndiaye',
    role: 'MEDECIN',
    companyName: 'Cabinet medical Awa Ndiaye',
    bio: 'Medecin generaliste disponible pour consultation a domicile.',
    city: 'Dakar',
    categoryName: 'Medecine generale',
    categoryOrder: 1,
    serviceName: 'Consultation medecin a domicile',
    serviceDescription:
      'Consultation medicale generale, orientation et suivi de base a domicile.',
    price: '15000',
    priceType: 'FIXE',
    travelMode: 'PRESTATAIRE_SE_DEPLACE',
    durationMinutes: 45,
    bookingAddress: 'Dakar Plateau, Avenue Pompidou',
    bookingNotes: 'Consultation demo creee pour tester le parcours medecin.',
    bookingStatus: 'CONFIRMEE',
    bookingOffsetHours: 24,
  },
  {
    key: 'prestataire',
    phone: '+221774222222',
    name: 'Mamadou Electricite',
    role: 'PRESTATAIRE',
    companyName: 'Jokko Electricite Services',
    bio: 'Prestataire electricien pour depannage et installation.',
    city: 'Dakar',
    categoryName: 'Electricite',
    categoryOrder: 2,
    serviceName: 'Depannage electricite',
    serviceDescription:
      'Diagnostic, petite reparation et remise en service electrique.',
    price: '12000',
    priceType: 'NEGOCIABLE',
    travelMode: 'PRESTATAIRE_SE_DEPLACE',
    durationMinutes: 60,
    bookingAddress: 'Dakar Sacre-Coeur 3',
    bookingNotes: 'Reservation demo pour tester un prestataire classique.',
    bookingStatus: 'EN_ATTENTE',
    bookingOffsetHours: 48,
  },
  {
    key: 'livreur',
    phone: '+221774333333',
    name: 'Ibrahima Livraison',
    role: 'PRESTATAIRE',
    companyName: 'Jokko Colis Express',
    bio: 'Livreur de colis intra-Dakar avec suivi simple.',
    city: 'Dakar',
    categoryName: 'Livraison de colis',
    categoryOrder: 3,
    serviceName: 'Livraison colis Dakar',
    serviceDescription:
      'Collecte et livraison de colis leger dans Dakar et proche banlieue.',
    price: '3500',
    priceType: 'FIXE',
    travelMode: 'TRANSPORT_COLIS',
    durationMinutes: 30,
    bookingAddress: 'Dakar Almadies, Route des Almadies',
    bookingNotes: 'Reservation demo pour tester le mode transport colis.',
    bookingStatus: 'CONFIRMEE',
    bookingOffsetHours: 72,
  },
];

function dateInHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours, 0, 0, 0);
  return date;
}

async function upsertUser(provider) {
  const passwordHash = await argon2.hash('demo12345');
  return prisma.utilisateur.upsert({
    where: { numeroTelephone: provider.phone },
    update: {
      nom: provider.name,
      role: provider.role,
      motDePasseHash: passwordHash,
      estActif: true,
      fournisseurOauth: null,
      identifiantOauth: null,
    },
    create: {
      numeroTelephone: provider.phone,
      nom: provider.name,
      role: provider.role,
      motDePasseHash: passwordHash,
      estActif: true,
    },
  });
}

async function upsertProfile(provider, userId) {
  return prisma.profilProfessionnel.upsert({
    where: { utilisateurId: userId },
    update: {
      nomEntreprise: provider.companyName,
      biographie: provider.bio,
      ville: provider.city,
      statutKyc: 'VERIFIE',
    },
    create: {
      utilisateurId: userId,
      nomEntreprise: provider.companyName,
      biographie: provider.bio,
      ville: provider.city,
      statutKyc: 'VERIFIE',
    },
  });
}

async function upsertCategory(provider) {
  return prisma.categorie.upsert({
    where: { nom: provider.categoryName },
    update: {
      ordreTri: provider.categoryOrder,
      estActive: true,
    },
    create: {
      nom: provider.categoryName,
      ordreTri: provider.categoryOrder,
      estActive: true,
      tauxCommission: '10.00',
    },
  });
}

async function upsertService(provider, profileId, categoryId) {
  const existing = await prisma.service.findFirst({
    where: {
      profilProfessionnelId: profileId,
      categorieId: categoryId,
      nom: provider.serviceName,
    },
  });

  const data = {
    profilProfessionnelId: profileId,
    categorieId: categoryId,
    nom: provider.serviceName,
    description: provider.serviceDescription,
    prix: provider.price,
    typePrix: provider.priceType,
    modeDeplacement: provider.travelMode,
    dureeMinutes: provider.durationMinutes,
    estDisponible: true,
    estObligatoire: false,
  };

  return existing
    ? prisma.service.update({ where: { id: existing.id }, data })
    : prisma.service.create({ data });
}

async function upsertReservation(provider, clientId, profileId, service) {
  const existing = await prisma.reservation.findFirst({
    where: {
      clientId,
      professionnelId: profileId,
      serviceId: service.id,
      notes: provider.bookingNotes,
    },
  });

  const data = {
    clientId,
    professionnelId: profileId,
    serviceId: service.id,
    dateHeure: dateInHours(provider.bookingOffsetHours),
    adresseClient: provider.bookingAddress,
    dureeMinutes: provider.durationMinutes,
    statut: provider.bookingStatus,
    notes: provider.bookingNotes,
    prixConvenu: service.prix,
  };

  return existing
    ? prisma.reservation.update({ where: { id: existing.id }, data })
    : prisma.reservation.create({ data });
}

async function main() {
  const client = await prisma.utilisateur.findUnique({
    where: { numeroTelephone: clientPhone },
  });

  if (!client) {
    throw new Error(`Client seed missing: ${clientPhone}. Run prisma:seed first.`);
  }

  const created = [];
  for (const provider of providers) {
    const user = await upsertUser(provider);
    const profile = await upsertProfile(provider, user.id);
    const category = await upsertCategory(provider);
    const service = await upsertService(provider, profile.id, category.id);
    const reservation = await upsertReservation(
      provider,
      client.id,
      profile.id,
      service,
    );

    created.push({
      type: provider.key,
      provider: user.nom,
      phone: user.numeroTelephone,
      service: service.nom,
      reservationId: reservation.id,
      status: reservation.statut,
    });
  }

  console.table(created);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
