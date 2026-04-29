import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleUtilisateur, StatutKyc } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30000);

type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
};

type ReservationData = {
  id: string;
  statut: string;
  professionnelId: string;
};

type PaymentInitiationData = {
  payment: {
    id: string;
  };
  gatewayReference: string;
};

describe('DisputesModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const timestamp = Date.now();
  const clientPhone = `+22177${String(timestamp).slice(-7)}`;
  const proPhone = `+22178${String(timestamp).slice(-7)}`;
  const adminPhone = `+22179${String(timestamp).slice(-7)}`;
  const clientPassword = `Client${timestamp}!`;
  const proPassword = `Pro${timestamp}!`;
  const adminPassword = `Admin${timestamp}!`;

  let clientToken = '';
  let proToken = '';
  let adminToken = '';
  let clientUserId = '';
  let proUserId = '';
  let adminUserId = '';
  let professionalProfileId = '';
  let categoryId = '';
  let serviceId = '';
  const reservationIds: string[] = [];
  const paymentIds: string[] = [];
  const disputeIds: string[] = [];

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

    const clientRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: clientPhone,
        name: 'Client Litige',
        email: `client-litige-${timestamp}@jokko.sn`,
        password: clientPassword,
      })
      .expect(201);
    clientUserId = clientRegister.body.data.user.id;

    const proRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: proPhone,
        name: 'Pro Litige',
        email: `pro-litige-${timestamp}@jokko.sn`,
        password: proPassword,
      })
      .expect(201);
    proUserId = proRegister.body.data.user.id;

    const adminRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: adminPhone,
        name: 'Admin Litige',
        email: `admin-litige-${timestamp}@jokko.sn`,
        password: adminPassword,
      })
      .expect(201);
    adminUserId = adminRegister.body.data.user.id;

    await prisma.utilisateur.update({
      where: { id: proUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });
    await prisma.utilisateur.update({
      where: { id: adminUserId },
      data: { role: RoleUtilisateur.ADMIN },
    });

    const clientLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: clientPhone, password: clientPassword })
      .expect(200);
    clientToken = clientLogin.body.data.accessToken;

    const proLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: proPhone, password: proPassword })
      .expect(200);
    proToken = proLogin.body.data.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: adminPhone, password: adminPassword })
      .expect(200);
    adminToken = adminLogin.body.data.accessToken;

    categoryId = (
      await prisma.categorie.create({
        data: {
          nom: `Categorie Litige ${timestamp}`,
          estActive: true,
        },
      })
    ).id;

    professionalProfileId = (
      await prisma.profilProfessionnel.create({
        data: {
          utilisateurId: proUserId,
          biographie: 'Prestataire de test litige',
          nomEntreprise: 'Jokko Disputes',
          statutKyc: StatutKyc.VERIFIE,
          ville: 'Dakar',
        },
      })
    ).id;

    serviceId = (
      await prisma.service.create({
        data: {
          profilProfessionnelId: professionalProfileId,
          categorieId: categoryId,
          nom: `Service Litige ${timestamp}`,
          description: 'Service de test pour le module litige.',
          prix: 20000,
          typePrix: 'FIXE',
          estDisponible: true,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.notification.deleteMany({
      where: {
        utilisateurId: {
          in: [clientUserId, proUserId, adminUserId].filter(Boolean),
        },
      },
    });
    await prisma.litige.deleteMany({
      where: {
        reporterUserId: {
          in: [clientUserId, proUserId].filter(Boolean),
        },
      },
    });
    await prisma.transactionPortefeuille.deleteMany({
      where: {
        OR: [
          { paiementId: { in: paymentIds } },
          { reference: { contains: 'wallet:dispute-resolution:' } },
        ],
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
        reservation: {
          OR: [
            { clientId: clientUserId || undefined },
            { professionnelId: professionalProfileId || undefined },
          ],
        },
      },
    });
    await prisma.paiement.deleteMany({
      where: {
        OR: [
          { id: { in: paymentIds } },
          { clientId: clientUserId || undefined },
          { professionalId: professionalProfileId || undefined },
        ],
      },
    });
    await prisma.reservation.deleteMany({
      where: {
        OR: [
          { id: { in: reservationIds } },
          { clientId: clientUserId || undefined },
          { professionnelId: professionalProfileId || undefined },
        ],
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
        id: { in: [clientUserId, proUserId, adminUserId].filter(Boolean) },
      },
    });
    await app.close();
  });

  async function createPaidReservation(
    idempotencySuffix: number,
  ): Promise<{ reservationId: string; paymentId: string }> {
    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId,
        dateHeure: new Date(
          Date.now() + (48 + idempotencySuffix) * 60 * 60 * 1000,
        ).toISOString(),
        adresseClient: 'Ouakam, Dakar',
        dureeMinutes: 60,
        notes: 'Scenario litige admin.',
      })
      .expect(201);

    const reservation =
      reservationResponse.body as ApiResponse<ReservationData>;
    const reservationId = reservation.data?.id ?? '';
    reservationIds.push(reservationId);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/confirm`)
      .set('Authorization', `Bearer ${proToken}`)
      .expect(200);

    const paymentInitiationResponse = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', `dispute-${reservationId}-${idempotencySuffix}`)
      .send({
        bookingId: reservationId,
        method: 'WAVE',
      })
      .expect(201);

    const paymentInitiation =
      paymentInitiationResponse.body as ApiResponse<PaymentInitiationData>;
    const paymentId = paymentInitiation.data?.payment.id ?? '';
    paymentIds.push(paymentId);

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        gatewayReference: paymentInitiation.data?.gatewayReference,
        status: 'completed',
      })
      .expect(200);

    return { reservationId, paymentId };
  }

  it('PATCH /api/v1/reservations/:id/dispute opens a dispute and marks escrow as disputed', async () => {
    const { reservationId, paymentId } = await createPaidReservation(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservationId}/dispute`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        reason:
          'Le prestataire ne sest pas presente et la prestation na pas ete fournie.',
      })
      .expect(200);

    const body = response.body as ApiResponse<ReservationData>;
    expect(body.message).toBe('Litige ouvert avec succes');
    expect(body.data?.statut).toBe('LITIGE');

    const dispute = await prisma.litige.findUnique({
      where: { reservationId },
    });
    disputeIds.push(dispute?.id ?? '');
    expect(dispute).not.toBeNull();
    expect(dispute?.paiementId).toBe(paymentId);

    const payment = await prisma.paiement.findUnique({
      where: { id: paymentId },
      select: { escrowStatus: true },
    });
    expect(payment?.escrowStatus).toBe('DISPUTED');
  });

  it('GET /api/v1/admin/disputes and GET /:id expose admin views with filters', async () => {
    const disputeId = disputeIds[0];

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/disputes?status=OUVERT&priority=HAUTE&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const listBody = listResponse.body as ApiResponse<Array<{ id: string }>>;
    expect(listBody.data?.some((item) => item.id === disputeId)).toBe(true);
    expect(listBody.meta).toBeDefined();

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detailBody = detailResponse.body as ApiResponse<{
      id: string;
      statut: string;
      payment: { escrowStatus: string } | null;
    }>;
    expect(detailBody.data?.id).toBe(disputeId);
    expect(detailBody.data?.payment?.escrowStatus).toBe('DISPUTED');
  });

  it('PATCH /api/v1/admin/disputes/:id/in-review then /resolve refunds the client and closes the reservation', async () => {
    const disputeId = disputeIds[0];

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/disputes/${disputeId}/in-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const resolveResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'REMBOURSER_CLIENT',
        notes:
          'Prestation non fournie. Remboursement integral valide par ladministration.',
      })
      .expect(200);

    const resolveBody = resolveResponse.body as ApiResponse<{
      dispute: {
        statut: string;
        montantRembourseClient: number;
      };
      clientRefundAmount: number;
    }>;
    expect(resolveBody.data?.dispute.statut).toBe('RESOLU');
    expect(resolveBody.data?.clientRefundAmount).toBe(20000);

    const dispute = await prisma.litige.findUnique({
      where: { id: disputeId },
      select: {
        statut: true,
        montantRembourseClient: true,
        reservationId: true,
        paiementId: true,
      },
    });
    expect(dispute?.statut).toBe('RESOLU');
    expect(Number(dispute?.montantRembourseClient)).toBe(20000);

    const payment = await prisma.paiement.findUnique({
      where: { id: dispute?.paiementId ?? '' },
      select: { statut: true, escrowStatus: true },
    });
    expect(payment?.statut).toBe('REMBOURSE');
    expect(payment?.escrowStatus).toBe('REFUNDED');

    const reservation = await prisma.reservation.findUnique({
      where: { id: dispute?.reservationId ?? '' },
      select: { statut: true },
    });
    expect(reservation?.statut).toBe('ANNULEE');
  });

  it('PATCH /api/v1/payments/:id/escrow/dispute creates a dispute and /admin/disputes/:id/reject releases funds to the professional wallet', async () => {
    const { reservationId, paymentId } = await createPaidReservation(2);

    await request(app.getHttpServer())
      .patch(`/api/v1/payments/${paymentId}/escrow/dispute`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        reason: 'Le client conteste une partie de la prestation.',
      })
      .expect(200);

    const dispute = await prisma.litige.findUnique({
      where: { reservationId },
      select: { id: true },
    });
    const disputeId = dispute?.id ?? '';
    disputeIds.push(disputeId);

    const rejectResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/disputes/${disputeId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Le dossier ne justifie pas une retenue des fonds escrow.',
      })
      .expect(200);

    const rejectBody = rejectResponse.body as ApiResponse<{
      statut: string;
    }>;
    expect(rejectBody.data?.statut).toBe('REJETE');

    const payment = await prisma.paiement.findUnique({
      where: { id: paymentId },
      select: { escrowStatus: true },
    });
    expect(payment?.escrowStatus).toBe('RELEASED');

    const walletTransaction = await prisma.transactionPortefeuille.findFirst({
      where: {
        paiementId: paymentId,
        reference: `wallet:dispute-resolution:${disputeId}`,
      },
    });
    expect(walletTransaction).not.toBeNull();
  });
});
