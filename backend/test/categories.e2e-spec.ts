import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleUtilisateur } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';

jest.setTimeout(30000);

describe('CategoriesModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const adminPhone = `+22173${String(timestamp).slice(-7)}`;
  const clientPhone = `+22174${String(timestamp).slice(-7)}`;
  const adminPassword = `AdminCat${timestamp}!`;
  const clientPassword = `ClientCat${timestamp}!`;
  const adminEmail = `admin-categories-${timestamp}@jokko.sn`;
  const clientEmail = `client-categories-${timestamp}@jokko.sn`;
  const categoryName = `Plomberie-${timestamp}`;
  const updatedCategoryName = `Plomberie-Sanitaire-${timestamp}`;

  let adminAccessToken = '';
  let clientAccessToken = '';
  let categoryId = '';

  type AuthResponseData = {
    accessToken?: string;
  };

  type CategoryResponseData = {
    id?: string;
    nom?: string;
    urlIcone?: string | null;
    ordreTri?: number;
    tauxCommission?: number;
    estActive?: boolean;
  };

  type ApiResponse = {
    success: boolean;
    message?: string;
    errorCode?: string;
    data?: AuthResponseData | CategoryResponseData | CategoryResponseData[];
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
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

  it('register admin and client users', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: adminPhone,
        name: 'Admin Categories',
        email: adminEmail,
        password: adminPassword,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: clientPhone,
        name: 'Client Categories',
        email: clientEmail,
        password: clientPassword,
      })
      .expect(201);
  });

  it('promote admin user to ADMIN role', async () => {
    await prisma.utilisateur.update({
      where: { numeroTelephone: adminPhone },
      data: { role: RoleUtilisateur.ADMIN },
    });
  });

  it('login admin and client', async () => {
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: adminPhone,
        password: adminPassword,
      })
      .expect(200);
    adminAccessToken =
      ((adminLoginResponse.body as ApiResponse).data as AuthResponseData)
        .accessToken ?? '';

    const clientLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: clientPhone,
        password: clientPassword,
      })
      .expect(200);
    clientAccessToken =
      ((clientLoginResponse.body as ApiResponse).data as AuthResponseData)
        .accessToken ?? '';

    expect(adminAccessToken).not.toHaveLength(0);
    expect(clientAccessToken).not.toHaveLength(0);
  });

  it('GET /api/v1/categories should initially return an array', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/admin/categories should fail for CLIENT role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        name: categoryName,
        sortOrder: 1,
      })
      .expect(403);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
  });

  it('POST /api/v1/admin/categories should create a category', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: categoryName,
        iconUrl: 'https://cdn.jokko.sn/icons/plomberie.png',
        sortOrder: 1,
        commissionRate: 12.5,
      })
      .expect(201);

    const body = response.body as ApiResponse;
    const data = body.data as CategoryResponseData;
    categoryId = data.id ?? '';

    expect(body.success).toBe(true);
    expect(body.message).toBe('Categorie creee avec succes.');
    expect(data.nom).toBe(categoryName);
    expect(data.tauxCommission).toBe(12.5);
    expect(categoryId).not.toHaveLength(0);
  });

  it('POST /api/v1/admin/categories should reject duplicate names', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: categoryName.toLowerCase(),
        sortOrder: 2,
      })
      .expect(409);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('CATEGORIES_NAME_ALREADY_USED');
  });

  it('GET /api/v1/categories should include the active category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as CategoryResponseData[];
    expect(data.some((category) => category.id === categoryId)).toBe(true);
  });

  it('PATCH /api/v1/admin/categories/:id should update the category', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: updatedCategoryName,
        iconUrl: 'https://cdn.jokko.sn/icons/plomberie-v2.png',
        sortOrder: 3,
        commissionRate: 15,
      })
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as CategoryResponseData;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Categorie mise a jour avec succes.');
    expect(data.nom).toBe(updatedCategoryName);
    expect(data.ordreTri).toBe(3);
    expect(data.tauxCommission).toBe(15);
  });

  it('PATCH /api/v1/admin/categories/:id should reject empty payloads', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(400);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('CATEGORIES_UPDATE_EMPTY');
  });

  it('PATCH /api/v1/admin/categories/:id/disable should disable the category', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}/disable`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as CategoryResponseData;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Categorie desactivee avec succes.');
    expect(data.estActive).toBe(false);
  });

  it('GET /api/v1/categories should no longer return the disabled category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as CategoryResponseData[];
    expect(data.some((category) => category.id === categoryId)).toBe(false);
  });
});
