import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtTokenService } from '../src/auth/application/services/jwt-token.service';
import { RoleUtilisateur } from '@prisma/client';

jest.setTimeout(15000);

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtTokenService: JwtTokenService;
  let authToken: string;
  let adminToken: string;
  let professionalToken: string;
  let reservationId: string;
  let gatewayReference: string;
  let serviceId: string;
  let clientId: string;
  let adminId: string;
  let professionalUserId: string;
  let professionalId: string;

  type ApiResponse = {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
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

    prisma = app.get(PrismaService);
    jwtTokenService = app.get(JwtTokenService);

    const timestamp = Date.now();

    // Créer le client
    const client = await prisma.utilisateur.create({
      data: {
        numeroTelephone: `+22177${String(timestamp).slice(-7)}`,
        nom: 'Test Client Paiement',
        role: RoleUtilisateur.CLIENT,
      },
    });
    clientId = client.id;

    // Créer l'admin
    const adminUser = await prisma.utilisateur.create({
      data: {
        numeroTelephone: `+22175${String(timestamp).slice(-7)}`,
        nom: 'Test Admin Paiement',
        role: RoleUtilisateur.ADMIN,
      },
    });
    adminId = adminUser.id;

    // Créer le professionnel
    const professionalUser = await prisma.utilisateur.create({
      data: {
        numeroTelephone: `+22178${String(timestamp).slice(-7)}`,
        nom: 'Test Professional Paiement',
        role: RoleUtilisateur.PRESTATAIRE,
      },
    });
    professionalUserId = professionalUser.id;

    const professional = await prisma.profilProfessionnel.create({
      data: {
        utilisateurId: professionalUser.id,
      },
    });
    professionalId = professional.id;

    // Créer une catégorie réelle
    const category = await prisma.categorie.create({
      data: {
        nom: `Categorie Test ${timestamp}`,
      },
    });

    // Créer un service
    const service = await prisma.service.create({
      data: {
        profilProfessionnelId: professional.id,
        categorieId: category.id,
        nom: 'Service Test Paiement',
        prix: 10000,
        typePrix: 'FIXE',
        description: 'Description test',
      },
    });
    serviceId = service.id;

    // Créer une réservation confirmée
    const reservation = await prisma.reservation.create({
      data: {
        clientId: client.id,
        professionnelId: professional.id,
        serviceId: service.id,
        dateHeure: new Date(),
        adresseClient: 'Adresse Test',
        prixConvenu: 10000,
        statut: 'CONFIRMEE',
      },
    });
    reservationId = reservation.id;

    // Générer les tokens JWT
    const clientTokens = await jwtTokenService.issueTokens({
      sub: client.id,
      role: RoleUtilisateur.CLIENT,
      phoneNumber: client.numeroTelephone,
    });
    authToken = `Bearer ${clientTokens.accessToken}`;

    const adminTokens = await jwtTokenService.issueTokens({
      sub: adminUser.id,
      role: RoleUtilisateur.ADMIN,
      phoneNumber: adminUser.numeroTelephone,
    });
    adminToken = `Bearer ${adminTokens.accessToken}`;

    const professionalTokens = await jwtTokenService.issueTokens({
      sub: professionalUser.id,
      role: RoleUtilisateur.PRESTATAIRE,
      phoneNumber: professionalUser.numeroTelephone,
    });
    professionalToken = `Bearer ${professionalTokens.accessToken}`;
  });

  async function createConfirmedReservation(): Promise<string> {
    const reservation = await prisma.reservation.create({
      data: {
        clientId,
        professionnelId: professionalId,
        serviceId,
        dateHeure: new Date(),
        adresseClient: 'Adresse Test Paiement',
        prixConvenu: 10000,
        statut: 'CONFIRMEE',
      },
    });

    return reservation.id;
  }

  async function initiateSuccessfulPayment(
    targetReservationId: string,
  ): Promise<{ paymentId: string; gatewayReference: string }> {
    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', authToken)
      .set('Idempotency-Key', `test-${targetReservationId}`)
      .send({ bookingId: targetReservationId, method: 'WAVE' })
      .expect(201);

    const initiateBody = initiateResponse.body as ApiResponse;
    const payment = initiateBody.data?.['payment'] as Record<string, unknown>;
    const targetGatewayReference = String(
      initiateBody.data?.['gatewayReference'],
    );

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        gatewayReference: targetGatewayReference,
        invoice_token: targetGatewayReference,
        status: 'completed',
      })
      .expect(200);

    return {
      paymentId: String(payment['id']),
      gatewayReference: targetGatewayReference,
    };
  }

  afterAll(async () => {
    // Nettoyage dans l'ordre des dépendances FK
    await prisma.transactionPortefeuille.deleteMany({
      where: { profilProfessionnelId: professionalId },
    });
    await prisma.evenementWebhookPaiement.deleteMany({
      where: {
        referenceFournisseur: {
          contains: '-',
        },
      },
    });
    await prisma.cleIdempotence.deleteMany({
      where: { cle: { startsWith: 'test-' } },
    });
    await prisma.demandeRetrait.deleteMany({
      where: { profilProfessionnelId: professionalId },
    });
    await prisma.paiement.deleteMany({ where: { clientId } });
    await prisma.reservation.deleteMany({ where: { clientId } });
    await prisma.service.deleteMany({
      where: { profilProfessionnelId: professionalId },
    });
    await prisma.profilProfessionnel.deleteMany({
      where: { id: professionalId },
    });
    await prisma.utilisateur.deleteMany({
      where: { id: { in: [clientId, adminId, professionalUserId] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  // ─── Auth guard ───────────────────────────────────────────────────────────
  it('POST /api/v1/payments/initiate → 401 sans token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .send({ bookingId: reservationId, method: 'WAVE' })
      .expect(401);
  });

  // ─── Initiation paiement ──────────────────────────────────────────────────
  it('POST /api/v1/payments/initiate → 201 avec token valide', async () => {
    const idempotencyKey = `test-${reservationId}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', authToken)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bookingId: reservationId, method: 'WAVE' })
      .expect(201);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('payment');
    expect(body.data).toHaveProperty('paymentUrl');
    expect(body.data).toHaveProperty('gatewayReference');

    const payment = body.data?.['payment'] as Record<string, unknown>;
    expect(payment['bookingId']).toBe(reservationId);
    expect(payment['method']).toBe('WAVE');
    expect(payment['commissionAmount']).toBe(1000);
    expect(payment['netAmount']).toBe(9000);
    gatewayReference = String(body.data?.['gatewayReference']);

    const replayResponse = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', authToken)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bookingId: reservationId, method: 'WAVE' })
      .expect(201);

    const replayBody = replayResponse.body as ApiResponse;
    const replayPayment = replayBody.data?.['payment'] as Record<
      string,
      unknown
    >;
    expect(replayPayment['id']).toBe(payment['id']);
    expect(replayBody.data?.['gatewayReference']).toBe(gatewayReference);

    const paymentsCount = await prisma.paiement.count({
      where: { reservationId },
    });
    expect(paymentsCount).toBe(1);
  });

  // ─── Double initiation (même réservation) ────────────────────────────────
  it('POST /api/v1/payments/initiate → 409 si paiement déjà existant', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', authToken)
      .set('Idempotency-Key', `test-conflict-${reservationId}`)
      .send({ bookingId: reservationId, method: 'WAVE' })
      .expect(409);

    const body = response.body as { success: boolean; errorCode?: string };
    expect(body.success).toBe(false);
  });

  // ─── Validation DTO ───────────────────────────────────────────────────────
  it('POST /api/v1/payments/initiate → 400 sans cle idempotence', async () => {
    const targetReservationId = await createConfirmedReservation();

    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', authToken)
      .send({ bookingId: targetReservationId, method: 'WAVE' })
      .expect(400);

    const body = response.body as { success: boolean; errorCode?: string };
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('PAYMENT_IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/payments/initiate → 400 si bookingId invalide', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', authToken)
      .set('Idempotency-Key', 'test-invalid-booking')
      .send({ bookingId: 'not-a-uuid', method: 'WAVE' })
      .expect(400);
  });

  // ─── Webhook ──────────────────────────────────────────────────────────────
  it('POST /api/v1/payments/webhook → 200 avec données webhook', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        gatewayReference,
        invoice_token: gatewayReference,
        status: 'completed',
      })
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    expect(updatedReservation?.statut).toBe('PAYEE_SEQUESTRE');

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: clientId,
        titre: 'Paiement confirme',
      },
    });
    expect(notification).not.toBeNull();

    const webhookEvent = await prisma.evenementWebhookPaiement.findUnique({
      where: { cleEvenement: `${gatewayReference}:completed` },
    });
    expect(webhookEvent?.statut).toBe('TRAITE');
  });

  it('POST /api/v1/payments/webhook → 200 sans données (reçu)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({})
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: Record<string, unknown>;
    };
    expect(body.success).toBe(true);
    expect(body.data?.['received']).toBe(true);
  });

  // ─── Historique paiements ─────────────────────────────────────────────────
  it('GET /api/v1/payments/history → 200 avec token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/payments/history')
      .set('Authorization', authToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('payments');
    expect(body.data).toHaveProperty('total');
  });

  it('GET /api/v1/payments/history → 401 sans token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/payments/history')
      .expect(401);
  });

  // ─── Détail d'un paiement ─────────────────────────────────────────────────
  it('GET /api/v1/payments/:id → 200 pour le bon utilisateur', async () => {
    const payment = await prisma.paiement.findFirst({
      where: { clientId },
    });

    if (!payment) {
      return; // skip si aucun paiement créé
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/payments/${payment.id}`)
      .set('Authorization', authToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', payment.id);
  });

  it('GET /api/v1/payments/:id → 404 si paiement inconnu', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/payments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authToken)
      .expect(404);
  });

  // ─── Escrow status ────────────────────────────────────────────────────────
  it('GET /api/v1/payments/:id/escrow/status → 200', async () => {
    const payment = await prisma.paiement.findFirst({
      where: { clientId },
    });

    if (!payment) {
      return;
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/payments/${payment.id}/escrow/status`)
      .set('Authorization', authToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('isLocked');
    expect(body.data).toHaveProperty('isReleased');
    expect(body.data).toHaveProperty('isDisputed');
  });

  it('PATCH /api/v1/payments/:id/escrow/release → 200', async () => {
    const targetReservationId = await createConfirmedReservation();
    const payment = await initiateSuccessfulPayment(targetReservationId);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/payments/${payment.paymentId}/escrow/release`)
      .set('Authorization', authToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('escrowReleased', true);

    const walletTransaction = await prisma.transactionPortefeuille.findUnique({
      where: { reference: `wallet:release:${payment.paymentId}` },
    });
    expect(walletTransaction).not.toBeNull();
    expect(Number(walletTransaction?.montant)).toBe(9000);
  });

  it('PATCH /api/v1/payments/:id/escrow/dispute → 200', async () => {
    const targetReservationId = await createConfirmedReservation();
    const payment = await initiateSuccessfulPayment(targetReservationId);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/payments/${payment.paymentId}/escrow/dispute`)
      .set('Authorization', authToken)
      .send({ reason: 'Prestation contestee par le client.' })
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('isDisputed', true);
  });

  // ─── Retrait ──────────────────────────────────────────────────────────────
  it('POST /api/v1/payments/withdraw → 400 si montant trop faible', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments/withdraw')
      .set('Authorization', professionalToken)
      .send({ amount: 500, method: 'WAVE' })
      .expect(400);
  });

  it('POST /api/v1/payments/withdraw → 400 si solde insuffisant', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/withdraw')
      .set('Authorization', professionalToken)
      .send({ amount: 50000, method: 'WAVE' })
      .expect(400);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('PAYMENT_INSUFFICIENT_FUNDS');
  });

  it('GET /api/v1/payments/withdrawals → 200', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/payments/withdrawals')
      .set('Authorization', professionalToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
  });

  // ─── Admin endpoints ──────────────────────────────────────────────────────
  it('GET /api/v1/admin/payments → 401 sans token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/payments')
      .expect(401);
  });

  it('GET /api/v1/admin/payments → 200 avec token admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/payments')
      .set('Authorization', adminToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('clientPayments');
    expect(body.data).toHaveProperty('professionalPayments');
    const clientPayments = body.data?.['clientPayments'] as {
      payments?: Array<Record<string, unknown>>;
    };
    const firstPayment = clientPayments.payments?.[0];
    if (firstPayment) {
      expect(firstPayment).toHaveProperty('id');
      expect(firstPayment).toHaveProperty('bookingId');
      expect(firstPayment).toHaveProperty('amount');
      expect(firstPayment).not.toHaveProperty('_id');
    }
  });

  it('GET /api/v1/admin/payments/statistics → 200 avec token admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/payments/statistics')
      .set('Authorization', adminToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('pendingEscrowReleases');
    expect(body.data).toHaveProperty('totalEscrowAmount');
    expect(body.data).toHaveProperty('totalPayments');
    expect(body.data).toHaveProperty('totalRevenue');
  });

  it('GET /api/v1/admin/payments/:id → 200 avec token admin', async () => {
    const payment = await prisma.paiement.findFirst({
      where: { clientId },
    });

    if (!payment) {
      return;
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/payments/${payment.id}`)
      .set('Authorization', adminToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', payment.id);
  });

  it('POST /api/v1/admin/payments/:id/refund → 201 avec token admin', async () => {
    const targetReservationId = await createConfirmedReservation();
    const payment = await initiateSuccessfulPayment(targetReservationId);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${payment.paymentId}/refund`)
      .set('Authorization', adminToken)
      .send({ reason: 'Remboursement de test.' })
      .expect(201);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('isRefunded', true);
  });

  it('GET /api/v1/admin/payments/escrow/pending → 200 avec token admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/payments/escrow/pending')
      .set('Authorization', adminToken)
      .expect(200);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/admin/payments/escrow/process-pending → 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/payments/escrow/process-pending')
      .set('Authorization', adminToken)
      .expect(201);

    const body = response.body as ApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('processedCount');
    expect(body.data).toHaveProperty('failedCount');
  });
});
