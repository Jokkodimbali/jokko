import { PrismaClient, RoleUtilisateur, StatutKyc, TypePrix, StatutReservation, StatutKyc } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Full Seed: All Tables...');

  // 1. Categories (toutes)
  const categories = [
    { nom: 'Santé', ordreTri: 1 },
    { nom: 'Plomberie', ordreTri: 2 },
    { nom: 'Electricité', ordreTri: 3 },
    { nom: 'Auto', ordreTri: 4 },
    { nom: 'Informatique', ordreTri: 5 },
    { nom: 'Cuisine', ordreTri: 6 },
    { nom: 'Beauté', ordreTri: 7 },
    { nom: 'BTP', ordreTri: 8 },
  ];

  for (const cat of categories) {
    await prisma.categorie.upsert({
      where: { nom: cat.nom },
      create: cat,
      update: cat,
    });
  }
  console.log('✅ Categories');

  // 2. Users (Admin, 2 Clients, 2 Profs)
  const users = [
    { phone: '+221771234567', name: 'Admin', role: RoleUtilisateur.ADMIN, pass: 'admin123' },
    { phone: '+221772345678', name: 'Client1', role: RoleUtilisateur.CLIENT, pass: 'client123' },
    { phone: '+221772345679', name: 'Client2', role: RoleUtilisateur.CLIENT, pass: 'client123' },
    { phone: '+221773456789', name: 'Prof Plombier', role: RoleUtilisateur.PRESTATAIRE, pass: 'prof123' },
    { phone: '+221773456790', name: 'Prof Docteur', role: RoleUtilisateur.PRESTATAIRE, pass: 'prof123' },
  ];

  for (const u of users) {
    const hash = await argon2.hash(u.pass);
    await prisma.utilisateur.upsert({
      where: { numeroTelephone: u.phone },
      create: { numeroTelephone: u.phone, nom: u.name, motDePasseHash: hash, role: u.role },
      update: { motDePasseHash: hash },
    });
  }
  console.log('✅ Users');

  // 3. Prof Profiles (VERIFIE)
  const profs = await prisma.utilisateur.findMany({ where: { role: RoleUtilisateur.PRESTATAIRE } });
  for (const p of profs) {
    await prisma.profilProfessionnel.upsert({
      where: { utilisateurId: p.id },
      create: {
        id: randomUUID(),
        utilisateurId: p.id,
        statutKyc: StatutKyc.VERIFIE,
        ville: 'Dakar',
        urlPieceIdentiteRecto: 'https://example.com/recto.jpg',
        urlPieceIdentiteVerso: 'https://example.com/verso.jpg',
      },
      update: {},
    });
  }
  console.log('✅ Prof Profiles');

  // 4. Services (FIXE + NEGOCIABLE)
  const santeCat = await prisma.categorie.findFirst({ where: { nom: 'Santé' } });
  const plombCat = await prisma.categorie.findFirst({ where: { nom: 'Plomberie' } });
  const prof1 = await prisma.profilProfessionnel.findFirst({ where: { utilisateur: { numeroTelephone: '+221773456790' } } });
  const prof2 = await prisma.profilProfessionnel.findFirst({ where: { utilisateur: { numeroTelephone: '+221773456789' } } });

  const services = [
    { profId: prof1!.id, catId: santeCat!.id, name: 'Consultation', price: 10000, type: TypePrix.FIXE },
    { profId: prof1!.id, catId: santeCat!.id, name: 'Chirurgie', price: 0, type: TypePrix.NEGOCIABLE },
    { profId: prof2!.id, catId: plombCat!.id, name: 'Déboucheur', price: 5000, type: TypePrix.FIXE },
  ];

  for (const s of services) {
    await prisma.service.create({
      data: {
        id: randomUUID(),
        profilProfessionnelId: s.profId,
        categorieId: s.catId,
        nom: s.name,
        description: `${s.name} description`,
        prix: s.price,
        typePrix: s.type,
      },
    });
  }
  console.log('✅ Services');

  // 5. Reservations (divers statuts)
  const client1 = await prisma.utilisateur.findUnique({ where: { numeroTelephone: '+221772345678' } });
  const client2 = await prisma.utilisateur.findUnique({ where: { numeroTelephone: '+221772345679' } });
  const service1 = await prisma.service.findFirst({ where: { nom: 'Consultation' } });
  const service2 = await prisma.service.findFirst({ where: { nom: 'Déboucheur' } });

  const reservations = [
    { clientId: client1!.id, profId: prof1!.id, serviceId: service1!.id, statut: StatutReservation.EN_ATTENTE, notes: 'Test1' },
    { clientId: client2!.id, profId: prof2!.id, serviceId: service2!.id, statut: StatutReservation.CONFIRMEE, notes: 'Test2' },
    { clientId: client1!.id, profId: prof1!.id, serviceId: service1!.id, statut: StatutReservation.TERMINEE, notes: 'Terminée' },
    { clientId: client2!.id, profId: prof2!.id, serviceId: service2!.id, statut: StatutReservation.ANNULEE, notes: 'Annulée' },
  ];

  for (const r of reservations) {
    await prisma.reservation.create({
      data: {
        id: randomUUID(),
        clientId: r.clientId,
        professionnelId: r.profId,
        serviceId: r.serviceId,
        dateHeure: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        dureeMinutes: 60,
        statut: r.statut,
        notes: r.notes,
      },
    });
  }
  console.log('✅ Reservations');

  // 6. Autres tables (samples)
  await prisma.disponibilite.create({
    data: {
      id: randomUUID(),
      profilProfessionnelId: prof1!.id,
      jourSemaine: 1,
      heureDebut: new Date('1970-01-01T09:00:00'),
      heureFin: new Date('1970-01-01T17:00:00'),
    },
  });
  console.log('✅ Disponibilités');

  console.log('🎉 ALL TABLES PUEBLED! Run tests maintenant.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

