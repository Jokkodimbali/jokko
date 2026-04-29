import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { RoleUtilisateur, StatutKyc } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LiveTrackingModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl = '';

  const uniqueSeed = randomUUID().replace(/-/g, '');
  const phoneSuffix = `${Date.now().toString().slice(-4)}${Math.floor(
    Math.random() * 1000,
  )
    .toString()
    .padStart(3, '0')}`;
  const clientPhone = `+22172${phoneSuffix}`;
  const professionalPhone = `+22173${phoneSuffix}`;
  const clientPassword = `ClientPass${uniqueSeed.slice(0, 8)}!`;
  const professionalPassword = `ProPass${uniqueSeed.slice(0, 8)}!`;

  let clientToken = '';
  let professionalToken = '';
  let clientUserId = '';
  let professionalUserId = '';
  let professionalProfileId = '';
  let categoryId = '';
  let serviceId = '';
  let reservationId = '';
  let paymentId = '';

  type AuthResponse = {
    data?: {
      accessToken?: string;
      user?: {
        id?: string;
      };
    };
  };

  type ApiResponse<T> = {
    success: boolean;
    message?: string;
    errorCode?: string;
    data?: T;
  };

  type PaymentInitiationData = {
    payment: {
      id: string;
    };
    gatewayReference: string;
  };

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

    return (response.body as AuthResponse).data?.user?.id ?? '';
  }

  async function login(phoneNumber: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password })
      .expect(200);

    return (response.body as AuthResponse).data?.accessToken ?? '';
  }

  function buildFutureIso(hoursAhead: number): string {
    return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
  }

  function connectSocket(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/socket`, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        timeout: 5000,
      });

      const timeout = setTimeout(() => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        socket.close();
        reject(new Error('Timed out while connecting socket client'));
      }, 5000);

      const onConnect = () => {
        clearTimeout(timeout);
        socket.off('connect_error', onError);
        resolve(socket);
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.close();
        reject(error);
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });
  }

  function waitForSocketEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timed out waiting for socket event ${event}`));
      }, 5000);

      const handler = (payload: T) => {
        clearTimeout(timeout);
        resolve(payload);
      };

      socket.once(event, handler);
    });
  }

  async function pause(milliseconds: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
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
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');

    prisma = app.get(PrismaService);

    clientUserId = await registerUser({
      phoneNumber: clientPhone,
      password: clientPassword,
      email: `client-tracking-${uniqueSeed}@jokko.sn`,
      name: 'Client Tracking',
    });
    professionalUserId = await registerUser({
      phoneNumber: professionalPhone,
      password: professionalPassword,
      email: `pro-tracking-${uniqueSeed}@jokko.sn`,
      name: 'Pro Tracking',
    });

    await prisma.utilisateur.update({
      where: { id: professionalUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });

    professionalProfileId = randomUUID();
    categoryId = randomUUID();
    serviceId = randomUUID();

    await prisma.profilProfessionnel.create({
      data: {
        id: professionalProfileId,
        utilisateurId: professionalUserId,
        biographie: 'Prestataire tracking',
        nomEntreprise: 'Jokko Tracking Services',
        ville: 'Dakar',
        statutKyc: StatutKyc.VERIFIE,
      },
    });

    await prisma.categorie.create({
      data: {
        id: categoryId,
        nom: `Categorie Tracking ${uniqueSeed.slice(0, 8)}`,
        ordreTri: 1,
      },
    });

    await prisma.service.create({
      data: {
        id: serviceId,
        profilProfessionnelId: professionalProfileId,
        categorieId: categoryId,
        nom: 'Service tracking test',
        description: 'Service de test pour le suivi temps reel',
        prix: 20000,
        typePrix: 'FIXE',
      },
    });

    clientToken = await login(clientPhone, clientPassword);
    professionalToken = await login(professionalPhone, professionalPassword);

    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId,
        dateHeure: buildFutureIso(24),
        adresseClient: 'Mermoz, Dakar',
        dureeMinutes: 60,
        notes: 'Reservation racine pour le module tracking.',
      })
      .expect(201);

    reservationId = (reservationResponse.body as ApiResponse<{ id: string }>)
      .data!.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const paymentInitiation = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', `tracking-${reservationId}`)
      .send({
        bookingId: reservationId,
        method: 'WAVE',
      })
      .expect(201);

    const paymentData = (
      paymentInitiation.body as ApiResponse<PaymentInitiationData>
    ).data!;
    paymentId = paymentData.payment.id;

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        gatewayReference: paymentData.gatewayReference,
        status: 'completed',
      })
      .expect(200);
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.notification.deleteMany({
      where: {
        utilisateurId: {
          in: [clientUserId, professionalUserId].filter(Boolean),
        },
      },
    });
    await prisma.pointTrackingReservation.deleteMany({
      where: {
        sessionTracking: {
          reservationId: reservationId || undefined,
        },
      },
    });
    await prisma.sessionTrackingReservation.deleteMany({
      where: {
        reservationId: reservationId || undefined,
      },
    });
    await prisma.presenceProfessionnel.deleteMany({
      where: {
        profilProfessionnelId: professionalProfileId || undefined,
      },
    });
    await prisma.transactionPortefeuille.deleteMany({
      where: {
        paiementId: paymentId || undefined,
      },
    });
    await prisma.evenementWebhookPaiement.deleteMany({
      where: {
        referenceFournisseur: { contains: 'mock-' },
      },
    });
    if (clientUserId) {
      await prisma.cleIdempotence.deleteMany({
        where: {
          portee: { contains: clientUserId },
        },
      });
    }
    await prisma.communicationReservation.deleteMany({
      where: {
        reservationId: reservationId || undefined,
      },
    });
    await prisma.paiement.deleteMany({
      where: {
        id: paymentId || undefined,
      },
    });
    await prisma.reservation.deleteMany({
      where: {
        id: reservationId || undefined,
      },
    });
    if (serviceId) {
      await prisma.service.deleteMany({
        where: { id: serviceId },
      });
    }
    if (categoryId) {
      await prisma.categorie.deleteMany({
        where: { id: categoryId },
      });
    }
    if (professionalProfileId) {
      await prisma.profilProfessionnel.deleteMany({
        where: { id: professionalProfileId },
      });
    }
    await prisma.utilisateur.deleteMany({
      where: {
        id: { in: [clientUserId, professionalUserId].filter(Boolean) },
      },
    });
    await app.close();
  });

  it('GET /api/v1/professionals/:id/presence returns offline state before socket connection', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}/presence`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ApiResponse<{
      professionalId: string;
      isOnline: boolean;
      status: string;
    }>;
    expect(body.data?.professionalId).toBe(professionalProfileId);
    expect(body.data?.isOnline).toBe(false);
    expect(body.data?.status).toBe('HORS_LIGNE');
  });

  it('professional socket connection marks presence online', async () => {
    const professionalSocket = await connectSocket(professionalToken);

    try {
      await pause(300);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/professionals/${professionalProfileId}/presence`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      const body = response.body as ApiResponse<{
        isOnline: boolean;
        status: string;
      }>;
      expect(body.data?.isOnline).toBe(true);
      expect(body.data?.status).toBe('EN_LIGNE');
    } finally {
      professionalSocket.close();
      await pause(300);
    }
  });

  it('PATCH /api/v1/reservations/:id/on-the-way creates tracking session, notification and outbox', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/on-the-way`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        latitude: 14.716677,
        longitude: -17.467686,
        accuracyMeters: 12.5,
        headingDegrees: 180,
        speedKmh: 28.4,
        locationLabel: 'Corniche Ouest, Dakar',
      })
      .expect(200);

    const body = response.body as ApiResponse<{
      reservationId: string;
      trackingStatus: string;
      presence: {
        status: string;
      };
    }>;
    expect(body.message).toBe(
      'Le trajet du prestataire vers la reservation a ete active.',
    );
    expect(body.data?.trackingStatus).toBe('EN_ROUTE');
    expect(body.data?.presence.status).toBe('EN_ROUTE');

    const session = await prisma.sessionTrackingReservation.findUnique({
      where: { reservationId },
      select: {
        statut: true,
        derniereLatitude: true,
        derniereLongitude: true,
      },
    });
    expect(session?.statut).toBe('EN_ROUTE');
    expect(Number(session?.derniereLatitude)).toBeCloseTo(14.716677, 6);
    expect(Number(session?.derniereLongitude)).toBeCloseTo(-17.467686, 6);

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: clientUserId,
        type: 'PRESTATAIRE_EN_ROUTE',
        donnees: {
          path: ['reservationId'],
          equals: reservationId,
        },
      },
      orderBy: { creeLe: 'desc' },
    });
    expect(notification).not.toBeNull();

    const outboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'live-tracking.session.started',
        payload: {
          path: ['reservationId'],
          equals: reservationId,
        },
      },
      orderBy: { creeLe: 'desc' },
    });
    expect(outboxEvent).not.toBeNull();
  });

  it('WebSocket tracking.location.update persists a point and delivers the live update to the subscribed client', async () => {
    const clientSocket = await connectSocket(clientToken);
    const professionalSocket = await connectSocket(professionalToken);

    try {
      clientSocket.emit('tracking.subscribe', {
        reservationId,
      });
      await pause(250);

      const liveUpdatePromise = waitForSocketEvent<{
        reservationId: string;
        trackingStatus: string;
        lastLatitude: number;
        lastLongitude: number;
      }>(clientSocket, 'tracking.location.updated');

      professionalSocket.emit('tracking.location.update', {
        reservationId,
        latitude: 14.720001,
        longitude: -17.470001,
        accuracyMeters: 8.2,
        headingDegrees: 210,
        speedKmh: 31.6,
        locationLabel: 'Point E, Dakar',
      });

      const liveUpdate = await liveUpdatePromise;
      expect(liveUpdate.reservationId).toBe(reservationId);
      expect(liveUpdate.trackingStatus).toBe('EN_ROUTE');
      expect(liveUpdate.lastLatitude).toBeCloseTo(14.720001, 6);
      expect(liveUpdate.lastLongitude).toBeCloseTo(-17.470001, 6);

      const point = await prisma.pointTrackingReservation.findFirst({
        where: {
          sessionTracking: {
            reservationId,
          },
        },
        orderBy: { enregistreLe: 'desc' },
      });
      expect(point).not.toBeNull();
      expect(Number(point?.latitude)).toBeCloseTo(14.720001, 6);
      expect(Number(point?.longitude)).toBeCloseTo(-17.470001, 6);
    } finally {
      clientSocket.close();
      professionalSocket.close();
    }
  });

  it('PATCH /api/v1/reservations/:id/start finalizes route tracking and moves presence to EN_PRESTATION', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/start`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}/live-tracking`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as ApiResponse<{
      trackingStatus: string;
      endedAt: string | null;
      presence: {
        status: string;
      };
    }>;
    expect(body.data?.trackingStatus).toBe('TERMINEE');
    expect(body.data?.endedAt).toBeTruthy();
    expect(body.data?.presence.status).toBe('EN_PRESTATION');
  });
});
