import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ReservationsModule (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  const uniqueSeed = randomUUID().replace(/-/g, '');
  const phoneSuffix = `${Date.now().toString().slice(-4)}${Math.floor(
    Math.random() * 1000,
  )
    .toString()
    .padStart(3, '0')}`;
  const emailSuffix = uniqueSeed.slice(0, 12);
  const clientPhone = `+22170${phoneSuffix}`;
  const clientPassword = `ClientPass${emailSuffix}!`;
  const professionalPhone = `+22171${phoneSuffix}`;
  const professionalPassword = `ProPass${emailSuffix}!`;
  const secondProfessionalPhone = `+22173${phoneSuffix}`;
  const secondProfessionalPassword = `Pro2Pass${emailSuffix}!`;
  const adminPhone = `+22172${phoneSuffix}`;
  const adminPassword = `AdminPass${emailSuffix}!`;
  const clientEmail = `client-${emailSuffix}@jokko.sn`;
  const professionalEmail = `pro-${emailSuffix}@jokko.sn`;
  const secondProfessionalEmail = `pro2-${emailSuffix}@jokko.sn`;
  const adminEmail = `admin-${emailSuffix}@jokko.sn`;

  let clientToken = '';
  let professionalToken = '';
  let adminToken = '';
  let clientUserId = '';
  let professionalUserId = '';
  let secondProfessionalUserId = '';
  let professionalProfileId = '';
  let secondProfessionalProfileId = '';
  let fixedServiceId = '';
  let negotiableServiceId = '';
  let secondProfessionalServiceId = '';

  type AuthResponse = {
    success: boolean;
    data?: {
      accessToken?: string;
      user?: {
        id?: string;
      };
    };
  };

  type ReservationView = {
    id: string;
    statut: string;
    professionnelId: string;
    serviceId: string;
    dateHeure: string;
    adresseClient: string;
    dureeMinutes: number;
    prixConvenu?: number | null;
    statutAjustementPrix?: string;
    prixAjustementPropose?: number | null;
    raisonAjustementPrix?: string | null;
    raisonAnnulation?: string | null;
    clientRating?: number | null;
    clientReview?: string | null;
    clientReviewedAt?: string | null;
  };

  type ReservationSuccessResponse = {
    success: boolean;
    message?: string;
    data?: ReservationView | ReservationView[];
  };

  type ErrorResponse = {
    success: boolean;
    errorCode?: string;
    message?: string;
  };

  function buildFutureIso(hoursAhead: number): string {
    return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
  }

  async function registerUser(input: {
    phoneNumber: string;
    password: string;
    email: string;
    name: string;
  }): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(input)
      .expect(201);
    const body = response.body as AuthResponse;
    return body.data?.user?.id ?? '';
  }

  async function login(phoneNumber: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password })
      .expect(200);
    const body = response.body as AuthResponse;
    return body.data?.accessToken ?? '';
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        forbidUnknownValues: true,
        exceptionFactory: buildValidationException,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    clientUserId = await registerUser({
      phoneNumber: clientPhone,
      password: clientPassword,
      email: clientEmail,
      name: 'Client Reservation',
    });
    professionalUserId = await registerUser({
      phoneNumber: professionalPhone,
      password: professionalPassword,
      email: professionalEmail,
      name: 'Pro Reservation',
    });
    secondProfessionalUserId = await registerUser({
      phoneNumber: secondProfessionalPhone,
      password: secondProfessionalPassword,
      email: secondProfessionalEmail,
      name: 'Pro Reservation Deux',
    });
    const adminUserId = await registerUser({
      phoneNumber: adminPhone,
      password: adminPassword,
      email: adminEmail,
      name: 'Admin Reservation',
    });

    await prisma.utilisateur.update({
      where: { id: professionalUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });
    await prisma.utilisateur.update({
      where: { id: adminUserId },
      data: { role: RoleUtilisateur.ADMIN },
    });
    await prisma.utilisateur.update({
      where: { id: secondProfessionalUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });

    clientToken = await login(clientPhone, clientPassword);
    professionalToken = await login(professionalPhone, professionalPassword);
    await login(secondProfessionalPhone, secondProfessionalPassword);
    adminToken = await login(adminPhone, adminPassword);

    professionalProfileId = randomUUID();
    secondProfessionalProfileId = randomUUID();
    const categoryId = randomUUID();
    fixedServiceId = randomUUID();
    negotiableServiceId = randomUUID();
    secondProfessionalServiceId = randomUUID();

    await prisma.profilProfessionnel.create({
      data: {
        id: professionalProfileId,
        utilisateurId: professionalUserId,
        biographie: 'Prestataire de test',
        nomEntreprise: 'Jokko Test Services',
        ville: 'Dakar',
        statutKyc: 'VERIFIE',
      },
      select: { id: true },
    });

    await prisma.categorie.create({
      data: {
        id: categoryId,
        nom: `Plomberie Test ${emailSuffix}`,
        ordreTri: 1,
      },
    });

    await prisma.profilProfessionnel.create({
      data: {
        id: secondProfessionalProfileId,
        utilisateurId: secondProfessionalUserId,
        biographie: 'Prestataire secondaire',
        nomEntreprise: 'Jokko Test Services Deux',
        ville: 'Dakar',
        statutKyc: 'VERIFIE',
      },
      select: { id: true },
    });

    await prisma.service.createMany({
      data: [
        {
          id: fixedServiceId,
          profilProfessionnelId: professionalProfileId,
          categorieId: categoryId,
          nom: 'Depannage plomberie',
          description: 'Intervention rapide',
          prix: 25000,
          typePrix: 'FIXE',
        },
        {
          id: negotiableServiceId,
          profilProfessionnelId: professionalProfileId,
          categorieId: categoryId,
          nom: 'Installation sur devis',
          description: 'Service negociable',
          prix: 50000,
          typePrix: 'NEGOCIABLE',
        },
        {
          id: secondProfessionalServiceId,
          profilProfessionnelId: secondProfessionalProfileId,
          categorieId: categoryId,
          nom: 'Electricite test',
          description: 'Intervention electrique',
          prix: 30000,
          typePrix: 'FIXE',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /api/v1/reservations creates a reservation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(24),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
        notes: 'Merci de venir avec le materiel.',
      })
      .expect(201);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;

    expect(body.success).toBe(true);
    expect(body.message).toBe('Reservation creee avec succes.');
    expect(data.statut).toBe('EN_ATTENTE');
    expect(data.professionnelId).toBe(professionalProfileId);
    expect(data.serviceId).toBe(fixedServiceId);
    expect(data.adresseClient).toBe('Dakar Plateau');

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: clientUserId,
        type: 'NOUVELLE_RESERVATION',
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(notification).not.toBeNull();
    expect(notification?.titre).toBe('Reservation enregistree');
    expect(notification?.corps).toContain('Depannage plomberie');

    const outboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'reservations.client.email-requested',
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(outboxEvent).not.toBeNull();
    expect(
      (outboxEvent?.payload as { recipientUserId?: string }).recipientUserId,
    ).toBe(clientUserId);

    const communicationRows = await prisma.communicationReservation.findMany({
      where: {
        reservationId: data.id,
        utilisateurId: clientUserId,
      },
      orderBy: { creeLe: 'asc' },
    });

    expect(communicationRows).toHaveLength(2);
    expect(communicationRows.map((row) => row.canal).sort()).toEqual([
      'EMAIL',
      'SMS',
    ]);

    const smsOutboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'reservations.client.sms-requested',
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(smsOutboxEvent).not.toBeNull();
    expect(
      (smsOutboxEvent?.payload as { recipientUserId?: string }).recipientUserId,
    ).toBe(clientUserId);
  });

  it('POST /api/v1/reservations refuses negotiable services', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: negotiableServiceId,
        dateHeure: buildFutureIso(30),
        adresseClient: 'Dakar Sacre-Coeur',
        dureeMinutes: 90,
      })
      .expect(409);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('RESERVATIONS_NEGOTIATION_REQUIRED');
  });

  it('POST /api/v1/reservations forbids a professional from booking their own service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(31),
        adresseClient: 'Dakar Hann',
        dureeMinutes: 60,
      })
      .expect(409);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('RESERVATIONS_SELF_BOOKING_FORBIDDEN');
  });

  it('GET /api/v1/reservations/my lists client reservations', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/reservations/my')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView[];

    expect(body.success).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/reservations/:id returns a reservation to its client', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(33),
        adresseClient: 'Dakar Medina',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservation.id}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(data.id).toBe(reservation.id);
  });

  it('PATCH /api/v1/reservations/:id/confirm confirms a reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(36),
        adresseClient: 'Dakar Almadies',
        dureeMinutes: 45,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const createdReservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${createdReservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Reservation confirmee avec succes.');
    expect(data.statut).toBe('CONFIRMEE');
  });

  it('PATCH /api/v1/reservations/:id/complete completes a reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(42),
        adresseClient: 'Dakar Mermoz',
        dureeMinutes: 30,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/mark-paid`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Reservation terminee avec succes.');
    expect(data.statut).toBe('TERMINEE');
  });

  it('PATCH /api/v1/reservations/:id/review submits a client review and updates professional aggregates', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(43),
        adresseClient: 'Dakar Mamelles',
        dureeMinutes: 45,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/mark-paid`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/review`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        rating: 5,
        review: 'Intervention tres propre et rapide.',
      })
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Avis client enregistre avec succes.');
    expect(data.clientRating).toBe(5);
    expect(data.clientReview).toBe('Intervention tres propre et rapide.');
    expect(data.clientReviewedAt).toBeTruthy();

    const persistedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: {
        clientRating: true,
        clientReview: true,
        clientReviewedAt: true,
      },
    });

    expect(persistedReservation?.clientRating).toBe(5);
    expect(persistedReservation?.clientReview).toBe(
      'Intervention tres propre et rapide.',
    );
    expect(persistedReservation?.clientReviewedAt).not.toBeNull();

    const updatedProfile = await prisma.profilProfessionnel.findUnique({
      where: { id: professionalProfileId },
      select: {
        noteGlobale: true,
        nombreAvis: true,
      },
    });

    expect(updatedProfile).not.toBeNull();
    expect(updatedProfile?.nombreAvis).toBeGreaterThanOrEqual(1);
    expect(updatedProfile?.noteGlobale.toNumber()).toBeGreaterThan(0);

    const reviewsResponse = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}/reviews`)
      .expect(200);

    const reviewsBody = reviewsResponse.body as ReservationSuccessResponse;
    const reviewsData = reviewsBody.data as Array<Record<string, unknown>>;
    expect(
      reviewsData.some(
        (item) =>
          item.id === reservation.id &&
          item.note === 5 &&
          item.commentaire === 'Intervention tres propre et rapide.',
      ),
    ).toBe(true);
  });

  it('PATCH /api/v1/reservations/:id/review refuses an already reviewed reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(43.5),
        adresseClient: 'Dakar Fass',
        dureeMinutes: 45,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/mark-paid`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/review`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        rating: 4,
        review: 'Bon travail.',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/review`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        rating: 2,
        review: 'Deuxieme avis interdit.',
      })
      .expect(400);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('RESERVATION_REVIEW_ALREADY_SUBMITTED');
  });

  it('PATCH /api/v1/reservations/:id/complete refuses a non paid reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(44),
        adresseClient: 'Dakar Point E',
        dureeMinutes: 45,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(400);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('RESERVATION_PAYMENT_REQUIRED');
  });

  it('PATCH /api/v1/reservations/:id/reschedule reschedules a reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(48),
        adresseClient: 'Dakar Ouakam',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;
    const newDateHeure = buildFutureIso(52);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ newDateTime: newDateHeure })
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Reservation reprogrammee avec succes.');
    expect(data.dateHeure).toBe(newDateHeure);
  });

  it('PATCH /api/v1/reservations/:id/cancel cancels a reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(60),
        adresseClient: 'Dakar Yoff',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'Le besoin a change.' })
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Reservation annulee avec succes.');
    expect(data.statut).toBe('ANNULEE');
  });

  it('PATCH /api/v1/reservations/:id/price-adjustment/propose lets the professional propose a new price', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(66),
        adresseClient: 'Dakar Maristes',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/price-adjustment/propose`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        proposedPrice: 32000,
        reason: 'Travaux supplementaires constates sur place.',
      })
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe(
      "Demande d'ajustement de prix envoyee au client avec succes.",
    );
    expect(data.statutAjustementPrix).toBe('EN_ATTENTE_CLIENT');
    expect(data.prixAjustementPropose).toBe(32000);
    expect(data.prixConvenu).toBe(25000);

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: clientUserId,
        type: 'AJUSTEMENT_PRIX_PROPOSE',
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(notification).not.toBeNull();
    expect(notification?.corps).toContain('32000 FCFA');
  });

  it('PATCH /api/v1/reservations/:id/price-adjustment/accept updates the agreed price', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(68),
        adresseClient: 'Dakar Derklé',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/price-adjustment/propose`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        proposedPrice: 18000,
        reason: 'Moins de travaux que prevu.',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/price-adjustment/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Ajustement de prix accepte avec succes.');
    expect(data.statutAjustementPrix).toBe('ACCEPTE');
    expect(data.prixConvenu).toBe(18000);
    expect(data.prixAjustementPropose).toBe(18000);

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: professionalUserId,
        type: 'AJUSTEMENT_PRIX_ACCEPTE',
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(notification).not.toBeNull();
  });

  it('PATCH /api/v1/reservations/:id/price-adjustment/reject keeps the original price', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(70),
        adresseClient: 'Dakar Rufisque',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/price-adjustment/propose`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        proposedPrice: 35000,
        reason: 'Pieces a remplacer en plus.',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/price-adjustment/reject`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Ajustement de prix refuse avec succes.');
    expect(data.statutAjustementPrix).toBe('REFUSE');
    expect(data.prixConvenu).toBe(25000);
    expect(data.prixAjustementPropose).toBe(35000);
  });

  it('PATCH /api/v1/reservations/:id/price-adjustment/propose refuses when a payment already exists', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(71),
        adresseClient: 'Dakar Sicap',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', `price-adjustment-${reservation.id}`)
      .send({ bookingId: reservation.id, method: 'WAVE' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/price-adjustment/propose`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        proposedPrice: 33000,
        reason: 'Nouveau perimetre des travaux.',
      })
      .expect(409);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(
      'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
    );
  });

  it('PATCH /api/v1/reservations/:id/no-show marks no-show', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(72),
        adresseClient: 'Dakar Parcelles Assainies',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/mark-paid`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/no-show`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Absence du client enregistree avec succes.');
    expect(data.statut).toBe('NO_SHOW');
  });

  it('PATCH /api/v1/reservations/:id/start refuses an unpaid reservation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(74),
        adresseClient: 'Dakar Grand Yoff',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/start`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(400);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('RESERVATION_PAYMENT_REQUIRED');
  });

  it('GET /api/v1/reservations/my lets a professional list reservations as client with scope=CLIENT', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        professionnelId: secondProfessionalProfileId,
        serviceId: secondProfessionalServiceId,
        dateHeure: buildFutureIso(84),
        adresseClient: 'Dakar Ngor',
        dureeMinutes: 60,
      })
      .expect(201);

    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .get('/api/v1/reservations/my')
      .query({ scope: 'CLIENT' })
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView[];
    expect(body.success).toBe(true);
    expect(
      data.some(
        (item) =>
          item.id === reservation.id &&
          item.serviceId === secondProfessionalServiceId,
      ),
    ).toBe(true);
  });

  it('GET /api/v1/reservations/my lists reservations assigned to the professional by default', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(86),
        adresseClient: 'Dakar Liberté 6',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .get('/api/v1/reservations/my')
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView[];
    expect(body.success).toBe(true);
    expect(data.some((item) => item.id === reservation.id)).toBe(true);
  });

  it('PATCH /api/v1/reservations/:id/cancel lets a professional reject a reservation assigned to them', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(90),
        adresseClient: 'Dakar Fann',
        dureeMinutes: 60,
      })
      .expect(201);

    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/cancel`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({ reason: 'Indisponible sur ce creneau.' })
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(data.statut).toBe('ANNULEE');
    expect(data.raisonAnnulation).toBe('Indisponible sur ce creneau.');
  });

  it('GET /api/v1/admin/reservations lists reservations for admins', async () => {
    const startDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/reservations')
      .query({ startDate, endDate })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView[];
    expect(body.success).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/admin/reservations/:id returns a reservation to admins', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId: fixedServiceId,
        dateHeure: buildFutureIso(96),
        adresseClient: 'Dakar HLM',
        dureeMinutes: 60,
      })
      .expect(201);
    const created = createResponse.body as ReservationSuccessResponse;
    const reservation = created.data as ReservationView;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/reservations/${reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as ReservationSuccessResponse;
    const data = body.data as ReservationView;
    expect(body.success).toBe(true);
    expect(data.id).toBe(reservation.id);
  });

  it('POST /api/v1/reservations/from-negotiation returns 404 for an unknown negotiation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations/from-negotiation')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        negotiationId: randomUUID(),
        dateHeure: buildFutureIso(80),
        adresseClient: 'Dakar Medina',
        dureeMinutes: 60,
      })
      .expect(404);

    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('NEGOTIATIONS_NOT_FOUND');
  });
});
