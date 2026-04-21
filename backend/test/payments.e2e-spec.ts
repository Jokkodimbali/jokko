import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { JwtTokenService } from '../src/auth/application/services/jwt-token.service';
import { RoleUtilisateur } from '@prisma/client';
import * as request from 'supertest';
import type { SuperTest, Test } from 'supertest';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtTokenService: JwtTokenService;
  let agent: SuperTest<Test>;
  let authToken: string;
  let reservationId: string;
  let clientId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    agent = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    jwtTokenService = app.get(JwtTokenService);

    const client = await prisma.utilisateur.create({
      data: {
        numeroTelephone: '+221777000001',
        nom: 'Test Client',
        role: RoleUtilisateur.CLIENT,
      },
    });
    clientId = client.id;

    const professionalUser = await prisma.utilisateur.create({
      data: {
        numeroTelephone: '+221777000002',
        nom: 'Test Professional',
        role: RoleUtilisateur.PRESTATAIRE,
      },
    });
    const professional = await prisma.profilProfessionnel.create({
      data: {
        utilisateurId: professionalUser.id,
      },
    });

    const tokens = await jwtTokenService.issueTokens({
      sub: client.id,
      role: RoleUtilisateur.CLIENT,
      phoneNumber: client.numeroTelephone,
    });
    authToken = `Bearer ${tokens.accessToken}`;

    const service = await prisma.service.create({
      data: {
        profilProfessionnelId: professional.id,
        categorieId: 'some-category-id',
        nom: 'Test Service',
        prix: 10000,
        typePrix: 'FIXE',
      },
    });

    const reservation = await prisma.reservation.create({
      data: {
        clientId: client.id,
        professionnelId: professional.id,
        serviceId: service.id,
        dateHeure: new Date(),
        prixConvenu: 10000,
        statut: 'CONFIRMEE',
      },
    });
    reservationId = reservation.id;
  });

  it('/payments/initiate (POST)', async () => {
    const response = await agent
      .post('/payments/initiate')
      .set('Authorization', authToken)
      .send({
        bookingId: reservationId,
        method: 'WAVE',
      })
      .expect(201);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('payment');
    expect(response.body.data).toHaveProperty('paymentUrl');
  });

  it('/payments/history (GET)', async () => {
    const response = await agent
      .get('/payments/history')
      .set('Authorization', authToken)
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });

  it('/payments/:id (GET)', async () => {
    const payment = await prisma.paiement.findFirst({
      where: { clientId },
    });

    if (payment) {
      const response = await agent
        .get(`/payments/${payment.id}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    }
  });

  it('/admin/payments (GET)', async () => {
    await agent.get('/admin/payments').expect(401);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });
});