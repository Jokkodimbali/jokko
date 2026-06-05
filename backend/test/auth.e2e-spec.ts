import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OtpService } from '../src/auth/application/services/otp.service';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const timestamp = Date.now();
  const phoneOtp = `+22177${String(timestamp).slice(-7)}`;
  const phoneRegister = `+22176${String(timestamp).slice(-7)}`;
  const phoneRegisterSecond = `+22170${String(timestamp).slice(-7)}`;
  const password = `TestPass${timestamp}!`;
  const email = `auth-${timestamp}@jokko.sn`;
  let refreshToken = '';
  let accessToken = '';

  type AuthSuccessResponse = {
    success: boolean;
    message?: string;
    data?: {
      expiresInSeconds?: number;
      accessToken?: string;
      refreshToken?: string;
      user?: {
        id?: string;
        phoneNumber?: string;
        numeroTelephone?: string;
        email?: string | null;
      };
      id?: string;
      numeroTelephone?: string;
    };
  };

  type AuthErrorResponse = {
    success: boolean;
    errorCode?: string;
    message?: string | string[];
  };

  function readRefreshCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === 'string'
        ? [setCookieHeader]
        : [];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith('jokko_refresh_token='),
    );
    return refreshCookie
      ? decodeURIComponent(
          refreshCookie.split(';')[0]?.split('=').slice(1).join('=') ?? '',
        )
      : '';
  }

  async function waitForAuditLog() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const auditLog = await prisma.journalAudit.findFirst({
        where: {
          utilisateurId: { not: null },
          nomUtilisateur: 'Test User',
          localisationTexte: 'Dakar Plateau',
        },
        orderBy: { creeLe: 'desc' },
      });

      if (auditLog) {
        return auditLog;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    return null;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OtpService)
      .useValue({
        create: jest.fn().mockResolvedValue({ expiresInSeconds: 300 }),
        verify: jest.fn().mockResolvedValue(true),
      })
      .compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/otp/send', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/send')
      .send({ phoneNumber: phoneOtp })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.expiresInSeconds).toBe(300);
  });

  it('POST /api/v1/auth/otp/verify', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phoneNumber: phoneOtp, code: '123456' })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeDefined();
  });

  it('POST /api/v1/auth/register', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: phoneRegister,
        name: 'Test User',
        email,
        password,
      })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.user?.phoneNumber).toBe(phoneRegister);
  });

  it('POST /api/v1/auth/register (duplicate email)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: phoneRegisterSecond,
        name: 'Test User 2',
        email: email.toUpperCase(),
        password,
      })
      .expect(409);
    const body = response.body as AuthErrorResponse;

    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_EMAIL_ALREADY_USED');
  });

  it('POST /api/v1/auth/login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: phoneRegister,
        password,
      })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeDefined();

    accessToken = body.data?.accessToken ?? '';
    refreshToken = readRefreshCookie(response);
    expect(refreshToken).not.toHaveLength(0);
  });

  it('POST /api/v1/auth/google/login (non configure)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google/login')
      .send({ idToken: 'fake-google-token-xxxxxxxxxxxxxxxxxxxxxxxx' })
      .expect(401);
    const body = response.body as AuthErrorResponse;

    expect(body.success).toBe(false);
    expect(['AUTH_GOOGLE_NOT_CONFIGURED', 'AUTH_GOOGLE_ACCOUNT_INVALID']).toContain(
      body.errorCode,
    );
  });

  it('POST /api/v1/auth/refresh', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeDefined();

    accessToken = body.data?.accessToken ?? '';
    refreshToken = readRefreshCookie(response);
    expect(refreshToken).not.toHaveLength(0);
  });

  it('GET /api/v1/auth/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-User-Latitude', '14.6928')
      .set('X-User-Longitude', '-17.4467')
      .set('X-User-Location-Label', 'Dakar Plateau')
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.id).toBeDefined();
    expect(body.data?.numeroTelephone).toBe(phoneRegister);
  });

  it('audit log should include user name and precise location context', async () => {
    const auditLog = await waitForAuditLog();

    expect(auditLog).not.toBeNull();
    expect(auditLog?.nomUtilisateur).toBe('Test User');
    expect(auditLog?.latitude?.toString()).toBe('14.6928');
    expect(auditLog?.longitude?.toString()).toBe('-17.4467');
  });

  it('POST /api/v1/auth/logout', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
  });
});
