import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';

describe('UsersModule (e2e)', () => {
  let app: INestApplication<App>;
  const timestamp = Date.now();
  const phoneNumber = `+22175${String(timestamp).slice(-7)}`;
  const otherPhoneNumber = `+22178${String(timestamp).slice(-7)}`;
  const password = `UsersPass${timestamp}!`;
  const otherPassword = `OtherPass${timestamp}!`;
  const email = `user-${timestamp}@jokko.sn`;
  const otherEmail = `other-${timestamp}@jokko.sn`;
  let accessToken = '';
  let refreshToken = '';

  type ApiObjectData = {
    accessToken?: string;
    refreshToken?: string;
    nom?: string;
    email?: string | null;
    adresse?: string | null;
    urlAvatar?: string | null;
    estActif?: boolean;
    numeroTelephone?: string;
    user?: {
      id?: string;
    };
  };

  type ApiHistoryItem = {
    id: string;
    adresseClient: string;
  };

  type ApiResponse = {
    success: boolean;
    message?: string;
    errorCode?: string;
    data?: ApiObjectData | ApiHistoryItem[];
  };

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('register users for users module tests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber,
        name: 'Users Test',
        email,
        password,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: otherPhoneNumber,
        name: 'Other Test',
        email: otherEmail,
        password: otherPassword,
      })
      .expect(201);
  });

  it('login main user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password })
      .expect(201);
    const body = response.body as ApiResponse;
    const data = body.data as ApiObjectData;

    accessToken = data.accessToken ?? '';
    refreshToken = data.refreshToken ?? '';
    expect(accessToken).not.toHaveLength(0);
    expect(refreshToken).not.toHaveLength(0);
  });

  it('GET /api/v1/users/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as ApiObjectData;
    expect(body.success).toBe(true);
    expect(data.numeroTelephone).toBe(phoneNumber);
  });

  it('PATCH /api/v1/users/me (success)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Nom Mis A Jour',
        address: 'Dakar, Senegal',
        avatarUrl: 'https://cdn.jokko.sn/avatar.png',
      })
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as ApiObjectData;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Profil mis a jour avec succes.');
    expect(data.nom).toBe('Nom Mis A Jour');
    expect(data.adresse).toBe('Dakar, Senegal');
    expect(data.urlAvatar).toBe('https://cdn.jokko.sn/avatar.png');
  });

  it('POST /api/v1/users/me/avatar (success)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        avatarUrl: 'https://cdn.jokko.sn/avatar-2.png',
      })
      .expect(201);

    const body = response.body as ApiResponse;
    const data = body.data as ApiObjectData;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Photo de profil mise a jour avec succes.');
    expect(data.urlAvatar).toBe('https://cdn.jokko.sn/avatar-2.png');
  });

  it('GET /api/v1/users/me/history', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me/history?limit=5')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    const data = body.data as ApiHistoryItem[];
    expect(Array.isArray(data)).toBe(true);
  });

  it('PATCH /api/v1/users/me (email already used)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: otherEmail })
      .expect(409);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('USERS_EMAIL_ALREADY_USED');
  });

  it('PATCH /api/v1/users/me (empty payload)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('USERS_UPDATE_EMPTY');
  });

  it('PATCH /api/v1/users/me (name with spaces only)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' })
      .expect(400);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_REQUEST_INVALID');
  });

  it('DELETE /api/v1/users/me', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Compte anonymise avec succes.');
  });

  it('POST /api/v1/auth/refresh should fail after anonymization', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });
});
