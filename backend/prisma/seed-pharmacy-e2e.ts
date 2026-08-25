import 'dotenv/config';
import {
  ModeDeplacementService,
  PrismaClient,
  StatutKyc,
  StatutReservation,
  TypePrix,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
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

async function main(): Promise<void> {
  if (process.argv[2] === '--mark-delivery-paid') {
    const reservationId = process.argv[3];
    if (!reservationId) throw new Error('reservationId est requis.');
    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: { statut: StatutReservation.PAYEE_SEQUESTRE },
      select: { id: true, statut: true },
    });
    process.stdout.write(`${JSON.stringify(reservation)}\n`);
    return;
  }

  const client = await prisma.utilisateur.findUniqueOrThrow({
    where: { numeroTelephone: '+221772345678' },
  });
  const courierUser = await prisma.utilisateur.findUniqueOrThrow({
    where: { numeroTelephone: '+221773456789' },
  });

  await prisma.utilisateur.update({
    where: { id: client.id },
    data: { adresse: 'Mermoz Sacre-Coeur, Dakar', estActif: true },
  });

  const professional = await prisma.profilProfessionnel.upsert({
    where: { utilisateurId: courierUser.id },
    update: { statutKyc: StatutKyc.VERIFIE, ville: 'Dakar' },
    create: {
      utilisateurId: courierUser.id,
      nomEntreprise: 'Jokko Livraison Test',
      statutKyc: StatutKyc.VERIFIE,
      ville: 'Dakar',
    },
  });

  await prisma.$executeRaw`
    UPDATE professional_profiles
    SET localisation = ST_SetSRID(ST_MakePoint(-17.467, 14.704), 4326)::geography
    WHERE id = ${professional.id}::uuid
  `;

  const healthCategory = await prisma.categorie.upsert({
    where: { nom: 'Sante test pharmacie' },
    update: { estActive: true },
    create: { nom: 'Sante test pharmacie', estActive: true },
  });
  const deliveryCategory = await prisma.categorie.upsert({
    where: { nom: 'Livraison test pharmacie' },
    update: { estActive: true },
    create: { nom: 'Livraison test pharmacie', estActive: true },
  });

  let medicalService = await prisma.service.findFirst({
    where: {
      profilProfessionnelId: professional.id,
      nom: 'Consultation medicale test pharmacie',
    },
  });
  medicalService ??= await prisma.service.create({
    data: {
      profilProfessionnelId: professional.id,
      categorieId: healthCategory.id,
      nom: 'Consultation medicale test pharmacie',
      description: 'Consultation terminee servant a la recette pharmacie.',
      prix: 5_000,
      typePrix: TypePrix.FIXE,
      dureeMinutes: 30,
    },
  });

  let deliveryService = await prisma.service.findFirst({
    where: {
      profilProfessionnelId: professional.id,
      nom: 'Livraison medicaments test',
    },
  });
  deliveryService ??= await prisma.service.create({
    data: {
      profilProfessionnelId: professional.id,
      categorieId: deliveryCategory.id,
      nom: 'Livraison medicaments test',
      description: 'Transport de medicaments pour la recette pharmacie.',
      prix: 500,
      typePrix: TypePrix.FIXE,
      modeDeplacement: ModeDeplacementService.TRANSPORT_COLIS,
      dureeMinutes: 30,
      estDisponible: true,
    },
  });

  const medicalReservation = await prisma.reservation.create({
    data: {
      clientId: client.id,
      professionnelId: professional.id,
      serviceId: medicalService.id,
      dateHeure: new Date(Date.now() - 60 * 60 * 1000),
      adresseClient: 'Mermoz Sacre-Coeur, Dakar',
      dureeMinutes: 30,
      statut: StatutReservation.TERMINEE,
      actesPrescriptionMedicale: ['Paracetamol 1000 mg'],
      vaccinsPrescriptionMedicale: [],
      traitementsPrescriptionMedicale: ['Amoxicilline 500 mg'],
      prixConvenu: 5_000,
      notes: 'Fixture E2E pharmacie du 25 aout 2026.',
    },
  });

  process.stdout.write(
    `${JSON.stringify({
      clientId: client.id,
      courierUserId: courierUser.id,
      courierProfessionalId: professional.id,
      deliveryServiceId: deliveryService.id,
      medicalReservationId: medicalReservation.id,
    })}\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
