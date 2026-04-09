import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OtpService } from '../src/auth/application/services/otp.service';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';

describe('AuthModule (e2e)', () => {
  let app: INestApplication<App>;
  const timestamp = Date.now();
  const phoneOtp = `+22177${String(timestamp).slice(-7)}`;
  const phoneRegister = `+22176${String(timestamp).slice(-7)}`;
  const password = `TestPass${timestamp}!`;
  let refreshToken = '';
  let accessToken = '';

  type AuthSuccessResponse = {
    success: boolean;
    message?: string;
    expiresInSeconds?: number;
    data?: {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/otp/send', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/send')
      .send({ phoneNumber: phoneOtp })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.expiresInSeconds).toBe(300);
  });

  it('POST /api/v1/auth/otp/verify', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phoneNumber: phoneOtp, code: '123456' })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeDefined();
    expect(body.data?.refreshToken).toBeDefined();
  });

  it('POST /api/v1/auth/register', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: phoneRegister,
        name: 'Test User',
        password,
      })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.user?.phoneNumber).toBe(phoneRegister);
  });

  it('POST /api/v1/auth/login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: phoneRegister,
        password,
      })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeDefined();
    expect(body.data?.refreshToken).toBeDefined();

    accessToken = body.data?.accessToken ?? '';
    refreshToken = body.data?.refreshToken ?? '';
  });

  it('POST /api/v1/auth/google/login (non configure)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google/login')
      .send({ idToken: 'fake-google-token-xxxxxxxxxxxxxxxxxxxxxxxx' })
      .expect(401);
    const body = response.body as AuthErrorResponse;

    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_GOOGLE_NOT_CONFIGURED');
  });

  it('POST /api/v1/auth/refresh', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeDefined();
    expect(body.data?.refreshToken).toBeDefined();

    accessToken = body.data?.accessToken ?? '';
    refreshToken = body.data?.refreshToken ?? '';
  });

  it('GET /api/v1/auth/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
    expect(body.data?.id).toBeDefined();
    expect(body.data?.numeroTelephone).toBe(phoneRegister);
  });

  it('POST /api/v1/auth/logout', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.success).toBe(true);
  });
});
