import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleUtilisateur, StatutKyc, StatutReservation } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';

describe('ProfessionalsModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const proPhone = `+22170${String(timestamp).slice(-7)}`;
  const clientPhone = `+22171${String(timestamp).slice(-7)}`;
  const adminPhone = `+22172${String(timestamp).slice(-7)}`;
  const proPassword = `ProPass${timestamp}!`;
  const clientPassword = `ClientPass${timestamp}!`;
  const adminPassword = `AdminPass${timestamp}!`;
  const proEmail = `pro-${timestamp}@jokko.sn`;
  const clientEmail = `client-${timestamp}@jokko.sn`;
  const adminEmail = `admin-${timestamp}@jokko.sn`;

  let proAccessToken = '';
  let clientAccessToken = '';
  let adminAccessToken = '';

  let professionalProfileId = '';
  let clientUserId = '';
  let categoryId = '';
  let serviceId = '';
  let portfolioItemId = '';
  let availabilityId = '';

  type AuthResponseData = {
    accessToken?: string;
    user?: {
      id?: string;
      phoneNumber?: string;
      role?: RoleUtilisateur;
    };
  };

  type ProfessionalProfileData = {
    id?: string;
    utilisateurId?: string;
    statutKyc?: StatutKyc;
    ville?: string | null;
    biographie?: string | null;
    nomEntreprise?: string | null;
    raisonRejetKyc?: string | null;
  };

  type ApiResponse = {
    success: boolean;
    message?: string;
    errorCode?: string;
    data?:
      | AuthResponseData
      | ProfessionalProfileData
      | { profiles: ProfessionalProfileData[]; total: number }
      | Record<string, unknown>[];
  };

  function getStringId(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

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

  it('register pro, client and admin users', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: proPhone,
        name: 'Pro User',
        email: proEmail,
        password: proPassword,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: clientPhone,
        name: 'Client User',
        email: clientEmail,
        password: clientPassword,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: adminPhone,
        name: 'Admin User',
        email: adminEmail,
        password: adminPassword,
      })
      .expect(201);
  });

  it('promote pro to PRESTATAIRE and admin to ADMIN', async () => {
    await prisma.utilisateur.update({
      where: { numeroTelephone: proPhone },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });
    await prisma.utilisateur.update({
      where: { numeroTelephone: adminPhone },
      data: { role: RoleUtilisateur.ADMIN },
    });
  });

  it('login pro, client and admin', async () => {
    const proLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: proPhone,
        password: proPassword,
      })
      .expect(200);
    const proBody = proLoginResponse.body as ApiResponse;
    const proData = proBody.data as AuthResponseData;
    proAccessToken = proData.accessToken ?? '';

    const clientLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: clientPhone,
        password: clientPassword,
      })
      .expect(200);
    const clientBody = clientLoginResponse.body as ApiResponse;
    const clientData = clientBody.data as AuthResponseData;
    clientAccessToken = clientData.accessToken ?? '';
    clientUserId = clientData.user?.id ?? '';

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: adminPhone,
        password: adminPassword,
      })
      .expect(200);
    const adminBody = adminLoginResponse.body as ApiResponse;
    const adminData = adminBody.data as AuthResponseData;
    adminAccessToken = adminData.accessToken ?? '';

    expect(proAccessToken).not.toHaveLength(0);
    expect(clientAccessToken).not.toHaveLength(0);
    expect(adminAccessToken).not.toHaveLength(0);
  });

  it('POST /api/v1/professionals/profile should fail for CLIENT role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/professionals/profile')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        bio: 'Je suis client',
      })
      .expect(403);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('PROFESSIONALS_FORBIDDEN_ROLE');
  });

  it('POST /api/v1/professionals/profile for PRESTATAIRE', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/professionals/profile')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        bio: 'Professionnel plomberie',
        companyName: 'Pro Services Dakar',
        city: 'Dakar',
      })
      .expect(201);

    const body = response.body as ApiResponse;
    const data = body.data as ProfessionalProfileData;
    professionalProfileId = data.id ?? '';

    expect(body.success).toBe(true);
    expect(body.message).toBe('Profil professionnel cree avec succes.');
    expect(professionalProfileId).not.toHaveLength(0);
  });

  it('GET /api/v1/professionals/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as ProfessionalProfileData;
    expect(body.success).toBe(true);
    expect(data.id).toBe(professionalProfileId);
  });

  it('PATCH /api/v1/professionals/me', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        bio: 'Bio mise a jour',
        city: 'Thies',
      })
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as ProfessionalProfileData;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Profil professionnel mis a jour avec succes.');
    expect(data.biographie).toBe('Bio mise a jour');
    expect(data.ville).toBe('Thies');
  });

  it('PATCH /api/v1/professionals/me/kyc/submit', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/professionals/me/kyc/submit')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        idCardUrl: 'https://cdn.jokko.sn/kyc/pro-id-card.png',
      })
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Document KYC soumis avec succes.');
  });

  it('POST /api/v1/professionals/me/services should fail if KYC is not verified', async () => {
    categoryId = (
      await prisma.categorie.create({
        data: {
          nom: `Plomberie-${timestamp}`,
          ordreTri: 1,
        },
      })
    ).id;

    const response = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/services')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        categoryId,
        name: 'Debouchage urgent',
        description: 'Intervention rapide',
        price: 15000,
        priceType: 'FIXE',
      })
      .expect(403);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('PROFESSIONALS_KYC_NOT_VERIFIED');
  });

  it('PATCH /api/v1/admin/kyc/:id/reject then approve', async () => {
    const rejectResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/kyc/${professionalProfileId}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        reason: 'Document flou. Merci de renvoyer une photo plus lisible.',
      })
      .expect(200);

    const rejectBody = rejectResponse.body as ApiResponse;
    const rejectData = rejectBody.data as ProfessionalProfileData;
    expect(rejectBody.success).toBe(true);
    expect(rejectBody.message).toBe('KYC rejete avec succes.');
    expect(rejectData.statutKyc).toBe(StatutKyc.REJETE);

    const approveResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/kyc/${professionalProfileId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const approveBody = approveResponse.body as ApiResponse;
    const approveData = approveBody.data as ProfessionalProfileData;
    expect(approveBody.success).toBe(true);
    expect(approveBody.message).toBe('KYC approuve avec succes.');
    expect(approveData.statutKyc).toBe(StatutKyc.VERIFIE);
  });

  it('manage professional services/portfolio/availabilities and seed review', async () => {
    const serviceCreateResponse = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/services')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        categoryId,
        name: 'Debouchage urgent',
        description: 'Intervention rapide',
        price: 15000,
        priceType: 'FIXE',
      })
      .expect(201);

    const serviceCreateBody = serviceCreateResponse.body as ApiResponse;
    const serviceCreateData = serviceCreateBody.data as Record<string, unknown>;
    serviceId = getStringId(serviceCreateData.id);
    expect(serviceId).not.toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/professionals/me/services/${serviceId}`)
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        name: 'Debouchage premium',
        price: 17000,
      })
      .expect(200);

    const portfolioCreateResponse = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/portfolio')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        title: 'Salle de bain renovee',
        description: 'Projet realise a Dakar',
        imageUrl: 'https://cdn.jokko.sn/portfolio/p1.png',
      })
      .expect(201);
    const portfolioCreateBody = portfolioCreateResponse.body as ApiResponse;
    const portfolioCreateData = portfolioCreateBody.data as Record<
      string,
      unknown
    >;
    portfolioItemId = getStringId(portfolioCreateData.id);

    const availabilityCreateResponse = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/availabilities')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .send({
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '18:00',
      })
      .expect(201);
    const availabilityCreateBody =
      availabilityCreateResponse.body as ApiResponse;
    const availabilityCreateData = availabilityCreateBody.data as Record<
      string,
      unknown
    >;
    availabilityId = getStringId(availabilityCreateData.id);

    await prisma.reservation.create({
      data: {
        clientId: clientUserId,
        professionnelId: professionalProfileId,
        serviceId,
        dateHeure: new Date(),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
        statut: StatutReservation.TERMINEE,
        notes: 'Tres professionnel',
      },
    });
  });

  it('GET /api/v1/professionals should return verified profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals?city=Thies&limit=10')
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as ProfessionalProfileData[];
    const profileIds = data.map((item) => item.id);
    expect(profileIds).toContain(professionalProfileId);
    expect(body.meta).toBeDefined();
  });

  it('GET /api/v1/professionals/:id should return profile detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as ProfessionalProfileData;
    expect(body.success).toBe(true);
    expect(data.id).toBe(professionalProfileId);
    expect(data.statutKyc).toBe(StatutKyc.VERIFIE);
  });

  it('GET /api/v1/professionals/:id/services', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}/services`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as Record<string, unknown>[];
    expect(body.success).toBe(true);
    expect(data.some((item) => item.id === serviceId)).toBe(true);
  });

  it('GET /api/v1/professionals/:id/portfolio', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}/portfolio`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as Record<string, unknown>[];
    expect(body.success).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/professionals/:id/availabilities', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}/availabilities`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as Record<string, unknown>[];
    expect(body.success).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/professionals/:id/reviews', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalProfileId}/reviews`)
      .expect(200);

    const body = response.body as ApiResponse;
    const data = body.data as Record<string, unknown>[];
    expect(body.success).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('DELETE /api/v1/professionals/me/portfolio/:itemId', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/professionals/me/portfolio/${portfolioItemId}`)
      .set('Authorization', `Bearer ${proAccessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
  });

  it('DELETE /api/v1/professionals/me/availabilities/:availabilityId', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/professionals/me/availabilities/${availabilityId}`)
      .set('Authorization', `Bearer ${proAccessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
  });

  it('DELETE /api/v1/professionals/me/services/:serviceId', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/professionals/me/services/${serviceId}`)
      .set('Authorization', `Bearer ${proAccessToken}`)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
  });
});
