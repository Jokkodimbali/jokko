import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeNotification } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('NotificationsModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let notificationId = '';
  const timestamp = Date.now();
  const phoneNumber = `+22176${String(timestamp).slice(-7)}`;
  const password = `NotifPass${timestamp}!`;

  type AuthResponseData = {
    accessToken?: string;
    user?: {
      id?: string;
    };
  };

  type NotificationResponseData = {
    id: string;
    isRead: boolean;
    title: string;
  };

  type MarkAllResponseData = {
    updatedCount: number;
  };

  type ApiResponse = {
    success: boolean;
    message?: string;
    data?: AuthResponseData | NotificationResponseData[] | MarkAllResponseData;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers and logs in a user', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber,
        name: 'Notifications Test',
        password,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password })
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as AuthResponseData;
    accessToken = data.accessToken ?? '';
    userId = data.user?.id ?? '';

    expect(accessToken).not.toHaveLength(0);
    expect(userId).not.toHaveLength(0);
  });

  it('GET /api/v1/notifications lists current user notifications', async () => {
    const notification = await prisma.notification.create({
      data: {
        utilisateurId: userId,
        type: TypeNotification.NOUVELLE_RESERVATION,
        titre: 'Reservation enregistree',
        corps: 'Votre reservation a ete enregistree.',
        donnees: { source: 'notifications-e2e' },
      },
    });
    notificationId = notification.id;

    const response = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as NotificationResponseData[];

    expect(body.success).toBe(true);
    expect(data.some((item) => item.id === notificationId)).toBe(true);
  });

  it('POST /api/v1/notifications/device-token stores FCM token', async () => {
    const fcmToken = `fcm-token-${timestamp}`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications/device-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fcmToken })
      .expect(200);

    const body = response.body as ApiResponse;
    const user = await prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { jetonFcm: true },
    });

    expect(body.success).toBe(true);
    expect(body.message).toBe('Token de notification mis a jour avec succes.');
    expect(user?.jetonFcm).toBe(fcmToken);
  });

  it('PATCH /api/v1/notifications/:id/read marks notification as read', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      message: string;
      data: NotificationResponseData;
    };

    expect(body.success).toBe(true);
    expect(body.message).toBe('Notification marquee comme lue avec succes.');
    expect(body.data.isRead).toBe(true);
  });

  it('PATCH /api/v1/notifications/read-all marks all notifications as read', async () => {
    await prisma.notification.create({
      data: {
        utilisateurId: userId,
        type: TypeNotification.NOUVELLE_RESERVATION,
        titre: 'Reservation enregistree',
        corps: 'Votre reservation a ete enregistree.',
      },
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      message: string;
      data: MarkAllResponseData;
    };
    const unreadCount = await prisma.notification.count({
      where: {
        utilisateurId: userId,
        estLue: false,
      },
    });

    expect(body.success).toBe(true);
    expect(body.message).toBe(
      'Toutes les notifications ont ete marquees comme lues.',
    );
    expect(body.data.updatedCount).toBeGreaterThanOrEqual(1);
    expect(unreadCount).toBe(0);
  });
});
