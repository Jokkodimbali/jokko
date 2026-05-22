import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleUtilisateur } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';

describe('Admin governance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const adminPhone = `+22176${String(timestamp).slice(-7)}`;
  const clientPhone = `+22177${String(timestamp).slice(-7)}`;
  const professionalPhone = `+22178${String(timestamp).slice(-7)}`;
  const adminPassword = `AdminGov${timestamp}!`;
  const clientPassword = `ClientGov${timestamp}!`;
  const professionalPassword = `ProGov${timestamp}!`;

  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let adminUserId = '';
  let clientUserId = '';
  let professionalUserId = '';
  let professionalProfileId = '';
  let categoryId = '';
  const serviceStructureCategoryIds: string[] = [];
  const serviceSubCategoryIds: string[] = [];
  let serviceId = '';
  let reservationId = '';

  type ApiResponse = {
    success: boolean;
    message?: string;
    errorCode?: string;
    data?: Record<string, unknown> | Record<string, unknown>[];
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
    await prisma.notification.deleteMany({
      where: {
        utilisateurId: {
          in: [adminUserId, clientUserId, professionalUserId].filter(Boolean),
        },
      },
    });
    await prisma.sessionAuthentification.deleteMany({
      where: {
        utilisateurId: {
          in: [adminUserId, clientUserId, professionalUserId].filter(Boolean),
        },
      },
    });
    if (reservationId) {
      await prisma.paiement.deleteMany({
        where: { reservationId },
      });
      await prisma.reservation.deleteMany({
        where: { id: reservationId },
      });
    }
    if (serviceId) {
      await prisma.service.deleteMany({
        where: { id: serviceId },
      });
    }
    if (professionalProfileId) {
      await prisma.profilProfessionnel.deleteMany({
        where: { id: professionalProfileId },
      });
    }
    if (categoryId) {
      await prisma.categorie.deleteMany({
        where: { id: categoryId },
      });
    }
    await prisma.categorieSousCategorie.deleteMany({
      where: {
        OR: [
          { categorieId: { in: serviceStructureCategoryIds } },
          { sousCategorieId: { in: serviceSubCategoryIds } },
        ],
      },
    });
    await prisma.sousCategorieService.deleteMany({
      where: { id: { in: serviceSubCategoryIds } },
    });
    await prisma.categorie.deleteMany({
      where: { id: { in: serviceStructureCategoryIds } },
    });
    await prisma.utilisateur.deleteMany({
      where: {
        id: {
          in: [adminUserId, clientUserId, professionalUserId].filter(Boolean),
        },
      },
    });
    await app.close();
  });

  it('register admin, client and professional users', async () => {
    const adminRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: adminPhone,
        name: 'Admin Gouvernance',
        email: `admin-governance-${timestamp}@jokko.sn`,
        password: adminPassword,
        role: 'CLIENT',
        adresse: 'Dakar gouvernance admin',
      })
      .expect(201);
    adminUserId = String(
      (adminRegister.body as ApiResponse).data?.['user']?.['id'] ?? '',
    );

    const clientRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: clientPhone,
        name: 'Client Gouvernance',
        email: `client-governance-${timestamp}@jokko.sn`,
        password: clientPassword,
        role: 'CLIENT',
        adresse: 'Dakar gouvernance client',
      })
      .expect(201);
    clientUserId = String(
      (clientRegister.body as ApiResponse).data?.['user']?.['id'] ?? '',
    );

    const professionalRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: professionalPhone,
        name: 'Pro Gouvernance',
        email: `pro-governance-${timestamp}@jokko.sn`,
        password: professionalPassword,
        role: 'PRESTATAIRE',
        adresse: 'Dakar gouvernance professionnel',
      })
      .expect(201);
    professionalUserId = String(
      (professionalRegister.body as ApiResponse).data?.['user']?.['id'] ?? '',
    );

    await prisma.utilisateur.update({
      where: { id: adminUserId },
      data: { role: RoleUtilisateur.ADMIN },
    });
    await prisma.utilisateur.update({
      where: { id: professionalUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });
  });

  it('login admin, client and professional', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: adminPhone, password: adminPassword })
      .expect(200);
    adminToken = String(
      (adminLogin.body as ApiResponse).data?.['accessToken'] ?? '',
    );

    const clientLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: clientPhone, password: clientPassword })
      .expect(200);
    clientToken = String(
      (clientLogin.body as ApiResponse).data?.['accessToken'] ?? '',
    );

    const professionalLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: professionalPhone, password: professionalPassword })
      .expect(200);
    professionalToken = String(
      (professionalLogin.body as ApiResponse).data?.['accessToken'] ?? '',
    );

    expect(adminToken).not.toHaveLength(0);
    expect(clientToken).not.toHaveLength(0);
    expect(professionalToken).not.toHaveLength(0);
  });

  it('create professional profile and submit KYC', async () => {
    const profileResponse = await request(app.getHttpServer())
      .post('/api/v1/professionals/profile')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        bio: 'Prestataire gouvernance',
        companyName: 'Top Pro',
        city: 'Dakar',
      })
      .expect(201);

    professionalProfileId = String(
      (profileResponse.body as ApiResponse).data?.['id'] ?? '',
    );

    await request(app.getHttpServer())
      .patch('/api/v1/professionals/me/kyc/submit')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        idCardUrl: 'https://cdn.jokko.sn/kyc/governance-recto.png',
        idCardUrlVerso: 'https://cdn.jokko.sn/kyc/governance-verso.png',
      })
      .expect(200);
  });

  it('GET /api/v1/admin/kyc and /:id expose the KYC dossier with document URLs', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/kyc?status=EN_ATTENTE&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const listData = (listResponse.body as ApiResponse).data as Array<
      Record<string, unknown>
    >;
    const kycItem = listData.find((item) => item.id === professionalProfileId);
    expect(kycItem).toBeDefined();

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/kyc/${professionalProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detail = (detailResponse.body as ApiResponse).data as Record<
      string,
      unknown
    >;
    expect(detail.urlPieceIdentiteRecto).toBe(
      'https://cdn.jokko.sn/kyc/governance-recto.png',
    );
    expect(detail.urlPieceIdentiteVerso).toBe(
      'https://cdn.jokko.sn/kyc/governance-verso.png',
    );
  });

  it('admin can block then unblock a user and auth respects the active flag', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${clientUserId}/block`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const blockedLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: clientPhone, password: clientPassword })
      .expect(403);

    expect((blockedLogin.body as ApiResponse).errorCode).toBe(
      'AUTH_ACCOUNT_INACTIVE',
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${clientUserId}/unblock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: clientPhone, password: clientPassword })
      .expect(200);
  });

  it('GET /api/v1/admin/users and /:id/history expose platform user management views', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/users?role=CLIENT&search=Client')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const users = (listResponse.body as ApiResponse).data as Array<
      Record<string, unknown>
    >;
    expect(users.some((item) => item.id === clientUserId)).toBe(true);

    const historyResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${clientUserId}/history?limit=5`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const history = (historyResponse.body as ApiResponse).data as Record<
      string,
      unknown
    >;
    expect(history).toHaveProperty('user');
    expect(history).toHaveProperty('reservationsAsClient');
    expect(history).toHaveProperty('paymentsAsClient');
  });

  it('admin can create a category with custom commission, approve KYC and the payment uses that rate', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Electricite-${timestamp}`,
        sortOrder: 1,
        commissionRate: 15,
      })
      .expect(201);

    categoryId = String(
      (categoryResponse.body as ApiResponse).data?.['id'] ?? '',
    );
    expect(
      (categoryResponse.body as ApiResponse).data?.['tauxCommission'],
    ).toBe(15);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/kyc/${professionalProfileId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const serviceResponse = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/services')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        categoryId,
        name: 'Diagnostic electrique',
        description: 'Verification premium',
        price: 10000,
        priceType: 'FIXE',
      })
      .expect(201);

    serviceId = String(
      (serviceResponse.body as ApiResponse).data?.['id'] ?? '',
    );

    const reservation = await prisma.reservation.create({
      data: {
        clientId: clientUserId,
        professionnelId: professionalProfileId,
        serviceId,
        dateHeure: new Date(),
        adresseClient: 'Dakar Plateau',
        prixConvenu: 10000,
        statut: 'CONFIRMEE',
      },
    });
    reservationId = reservation.id;

    const paymentResponse = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', `admin-gov-${reservationId}`)
      .send({ bookingId: reservationId, method: 'WAVE' })
      .expect(201);

    const payment = (paymentResponse.body as ApiResponse).data?.[
      'payment'
    ] as Record<string, unknown>;
    expect(payment.commissionAmount).toBe(1500);
    expect(payment.netAmount).toBe(8500);

    const paymentRow = await prisma.paiement.findUnique({
      where: { reservationId },
    });
    expect(Number(paymentRow?.montantCommission)).toBe(1500);
  });

  it('admin broadcast sends mass notifications to targeted users', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        target: 'CLIENT',
        title: 'Maintenance planifiee',
        body: 'Une maintenance courte est prevue ce soir.',
        data: { kind: 'maintenance' },
      })
      .expect(201);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(Number(body.data?.['recipientCount'])).toBeGreaterThanOrEqual(1);

    const clientNotification = await prisma.notification.findFirst({
      where: {
        utilisateurId: clientUserId,
        type: 'ANNONCE_ADMIN',
      },
    });
    expect(clientNotification).not.toBeNull();

    const professionalNotification = await prisma.notification.findFirst({
      where: {
        utilisateurId: professionalUserId,
        type: 'ANNONCE_ADMIN',
      },
    });
    expect(professionalNotification).toBeNull();
  });

  it('GET /api/v1/admin/dashboard returns platform-level analytics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = (response.body as ApiResponse).data as Record<string, unknown>;
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('reservations');
    expect(data).toHaveProperty('disputes');
    expect(data).toHaveProperty('revenue');
  });

  it('GET /api/v1/admin/revenue returns payment-backed revenue analytics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/revenue?period=30d')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = (response.body as ApiResponse).data as Record<string, unknown>;
    expect(data).toMatchObject({
      period: '30d',
      totals: expect.objectContaining({
        gross: expect.any(Number),
        net: expect.any(Number),
        commission: expect.any(Number),
        totalPayments: expect.any(Number),
      }),
    });
    expect(Array.isArray(data['series'])).toBe(true);
    expect(Array.isArray(data['methods'])).toBe(true);
    expect(Array.isArray(data['recentPayments'])).toBe(true);
  });

  it('GET /api/v1/admin/archives returns a paginated archive tab', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/archives?tab=transactions&limit=5&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = (response.body as ApiResponse).data as Record<string, unknown>;
    expect(data['pagination']).toMatchObject({
      tab: 'transactions',
      limit: 5,
      offset: 0,
      total: expect.any(Number),
    });
    expect(Array.isArray(data['transactions'])).toBe(true);
    expect(Array.isArray(data['invoices'])).toBe(true);
    expect(Array.isArray(data['closedDisputes'])).toBe(true);
  });

  it('manages the admin service structure with bulk categories and assigned subcategories', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/service-structure/categories/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categories: [
          {
            name: `Structure-${timestamp}`,
            sortOrder: 9,
            commissionRate: 10,
          },
        ],
      })
      .expect(201);

    const createdCategories = (categoryResponse.body as ApiResponse).data?.[
      'created'
    ] as Array<Record<string, unknown>>;
    const structureCategoryId = String(createdCategories[0]?.['id'] ?? '');
    serviceStructureCategoryIds.push(structureCategoryId);

    const firstSubCategory = await request(app.getHttpServer())
      .post('/api/v1/admin/service-structure/subcategories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Sous categorie ${timestamp}`,
        description: 'Affectation e2e',
      })
      .expect(201);
    const firstSubCategoryId = String(
      (firstSubCategory.body as ApiResponse).data?.['id'] ?? '',
    );
    serviceSubCategoryIds.push(firstSubCategoryId);

    const bulkSubCategories = await request(app.getHttpServer())
      .post('/api/v1/admin/service-structure/subcategories/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subCategories: [{ name: `Sous categorie bulk ${timestamp}` }],
      })
      .expect(201);
    const bulkCreated = (bulkSubCategories.body as ApiResponse).data?.[
      'created'
    ] as Array<Record<string, unknown>>;
    const bulkSubCategoryId = String(bulkCreated[0]?.['id'] ?? '');
    serviceSubCategoryIds.push(bulkSubCategoryId);

    const assignmentResponse = await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/service-structure/categories/${structureCategoryId}/subcategories`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subCategoryIds: serviceSubCategoryIds })
      .expect(200);

    const assignmentData = (assignmentResponse.body as ApiResponse)
      .data as Record<string, unknown>;
    expect(assignmentData['subCategories']).toHaveLength(2);

    const structureResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/service-structure')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const structureData = (structureResponse.body as ApiResponse)
      .data as Record<string, unknown>;
    const categories = structureData['categories'] as Array<
      Record<string, unknown>
    >;
    const createdCategory = categories.find(
      (category) => category['id'] === structureCategoryId,
    );
    expect(createdCategory?.['subCategories']).toHaveLength(2);

    await request(app.getHttpServer())
      .post('/api/v1/admin/service-structure/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
