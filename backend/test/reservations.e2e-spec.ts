import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import supertest from 'supertest';
import { randomUUID } from 'node:crypto';

describe('Reservations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let clientToken: string;
  let professionalToken: string;
  let professionalId: string;
  let serviceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Create test data
    // Assume auth endpoints work to get tokens - in real scenario use login
    // For demo, skip detailed auth setup or use test users

    // Create professional and service (simplified)
    const professionalUser = await prisma.utilisateur.create({
      data: {
        id: randomUUID(),
        numeroTelephone: `+22177${Math.floor(Math.random() * 9000000 + 1000000)}`,
        nom: 'Test Professional',
        role: 'PRESTATAIRE',
      },
    });

    const profile = await prisma.profilProfessionnel.create({
      data: {
        id: randomUUID(),
        utilisateurId: professionalUser.id,
        statutKyc: 'VERIFIE',
        statutKyc: 'VERIFIE',
      },
    });

    professionalId = profile.id;

    const category = await prisma.categorie.create({
      data: { id: randomUUID(), nom: 'Test', ordreTri: 0 },
    });

    const service = await prisma.service.create({
      data: {
        id: randomUUID(),
        profilProfessionnelId: profile.id,
        categorieId: category.id,
        nom: 'Test Service',
        description: 'Test',
        prix: 5000,
        typePrix: 'FIXE',
      },
    });

    serviceId = service.id;

    // Tokens would be obtained from auth endpoints
    // Mock tokens for demo
    adminToken = 'mock-admin-jwt';
    clientToken = 'mock-client-jwt';
    professionalToken = 'mock-professional-jwt';
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('User Endpoints', () => {
    it('/POST reservations (201)', async () => {
      return supertest(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          professionnelId,
          serviceId,
          dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dureeMinutes: 60,
          notes: 'Test reservation',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.statut).toBe('EN_ATTENTE');
        });
    });

    it('/POST reservations/from-negotiation (400)', async () => {
      return supertest(app.getHttpServer())
        .post('/reservations/from-negotiation')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          negotiationId: randomUUID(),
          dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dureeMinutes: 60,
        })
        .expect(409); // timeSlotUnavailable used
    });

    it('/GET reservations/my (200)', async () => {
      return supertest(app.getHttpServer())
        .get('/reservations/my')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
    });

    it('/GET reservations/:id (200)', async () => {
      // Assume reservation created above
      return supertest(app.getHttpServer())
        .get('/reservations/test-reservation-id')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
    });

    // Add tests for confirm, cancel, reschedule, complete, no-show
  });

  describe('Admin Endpoints', () => {
    it('/GET admin/reservations (200)', async () => {
      return supertest(app.getHttpServer())
        .get('/admin/reservations?startDate=2024-01-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('/GET admin/reservations/:id (200)', async () => {
      return supertest(app.getHttpServer())
        .get('/admin/reservations/test-reservation-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
