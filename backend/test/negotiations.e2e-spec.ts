import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('NegotiationsModule (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const uniqueSeed = randomUUID().replace(/-/g, '');
  const phoneSuffix = `${Date.now().toString().slice(-4)}${Math.floor(
    Math.random() * 1000,
  )
    .toString()
    .padStart(3, '0')}`;
  const clientPhone = `+22179${phoneSuffix}`;
  const professionalPhone = `+22174${phoneSuffix}`;
  const clientPassword = `ClientNeg1${uniqueSeed.slice(0, 8)}!`;
  const professionalPassword = `ProNeg1${uniqueSeed.slice(0, 8)}!`;
  const clientEmail = `client-neg-${uniqueSeed.slice(0, 8)}@jokko.sn`;
  const professionalEmail = `pro-neg-${uniqueSeed.slice(0, 8)}@jokko.sn`;

  let clientToken = '';
  let professionalToken = '';
  let clientUserId = '';
  let professionalUserId = '';
  let professionalProfileId = '';
  let categoryId = '';
  let negotiableServiceId = '';
  let fixedServiceId = '';
  let negotiationId = '';
  let rejectedNegotiationId = '';
  let cancelledNegotiationId = '';
  let acceptedFollowupNegotiationId = '';

  type AuthResponse = {
    success: boolean;
    data?: {
      accessToken?: string;
      user?: { id?: string };
    };
  };

  async function registerUser(input: {
    phoneNumber: string;
    password: string;
    email: string;
    name: string;
  }): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        ...input,
        role: 'CLIENT',
        adresse: 'Dakar Plateau',
      })
      .expect(201);
    const body = response.body as AuthResponse;
    return body.data?.user?.id ?? '';
  }

  async function login(phoneNumber: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password })
      .expect(200);
    const body = response.body as AuthResponse;
    return body.data?.accessToken ?? '';
  }

  function buildFutureIso(hoursAhead: number): string {
    return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
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

    prisma = app.get(PrismaService);

    clientUserId = await registerUser({
      phoneNumber: clientPhone,
      password: clientPassword,
      email: clientEmail,
      name: 'Client Negotiation',
    });
    professionalUserId = await registerUser({
      phoneNumber: professionalPhone,
      password: professionalPassword,
      email: professionalEmail,
      name: 'Pro Negotiation',
    });

    await prisma.utilisateur.update({
      where: { id: professionalUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });

    clientToken = await login(clientPhone, clientPassword);
    professionalToken = await login(professionalPhone, professionalPassword);

    professionalProfileId = randomUUID();
    categoryId = randomUUID();
    negotiableServiceId = randomUUID();
    fixedServiceId = randomUUID();

    await prisma.profilProfessionnel.create({
      data: {
        id: professionalProfileId,
        utilisateurId: professionalUserId,
        biographie: 'Prestataire negociable',
        ville: 'Dakar',
        statutKyc: 'VERIFIE',
      },
    });

    await prisma.categorie.create({
      data: {
        id: categoryId,
        nom: `Categorie Neg ${uniqueSeed.slice(0, 6)}`,
      },
    });

    await prisma.service.create({
      data: {
        id: negotiableServiceId,
        profilProfessionnelId: professionalProfileId,
        categorieId: categoryId,
        nom: 'Service negociable test',
        description: 'Service avec prix negociable',
        prix: 20000,
        typePrix: 'NEGOCIABLE',
      },
    });

    await prisma.service.create({
      data: {
        id: fixedServiceId,
        profilProfessionnelId: professionalProfileId,
        categorieId: categoryId,
        nom: 'Service prix fixe test',
        description: 'Service avec prix fixe',
        prix: 25000,
        typePrix: 'FIXE',
      },
    });
  });

  afterAll(async () => {
    if (clientUserId) {
      await prisma.notification.deleteMany({
        where: { utilisateurId: { in: [clientUserId, professionalUserId] } },
      });
      await prisma.communicationReservation.deleteMany({
        where: { utilisateurId: { in: [clientUserId, professionalUserId] } },
      });
      await prisma.propositionNegotiation.deleteMany({
        where: { negotiation: { clientId: clientUserId } },
      });
      await prisma.negotiation.deleteMany({
        where: { clientId: clientUserId },
      });
      await prisma.reservation.deleteMany({
        where: { clientId: clientUserId },
      });
      if (professionalProfileId) {
        await prisma.service.deleteMany({
          where: { profilProfessionnelId: professionalProfileId },
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
        where: { id: { in: [clientUserId, professionalUserId] } },
      });
    }
    await app.close();
  });

  it('POST /api/v1/negotiations creates a negotiation for a negotiable service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/negotiations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: negotiableServiceId,
        proposedAmount: 17000,
        message: 'Je peux confirmer aujourd hui a ce budget.',
      })
      .expect(201);

    const body = response.body as {
      success: boolean;
      data: { id: string; statut: string; montantCourant: number };
    };
    negotiationId = body.data.id;

    expect(body.success).toBe(true);
    expect(body.data.statut).toBe('EN_ATTENTE_PRESTATAIRE');
    expect(body.data.montantCourant).toBe(17000);
  });

  it('GET /api/v1/negotiations/my lists negotiations for the professional scope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/negotiations/my')
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: Array<{ id: string }>;
    };

    expect(body.success).toBe(true);
    expect(body.data.some((item) => item.id === negotiationId)).toBe(true);
  });

  it('GET /api/v1/negotiations/:id returns the negotiation for the client', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/negotiations/${negotiationId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { id: string; serviceId: string; dernierProposePar: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.id).toBe(negotiationId);
    expect(body.data.serviceId).toBe(negotiableServiceId);
    expect(body.data.dernierProposePar).toBe('CLIENT');
  });

  it('PATCH /api/v1/negotiations/:id/counter lets the professional counter the offer', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/negotiations/${negotiationId}/counter`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        proposedAmount: 18500,
        message: 'Je peux intervenir a ce tarif.',
      })
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: {
        statut: string;
        montantCourant: number;
        dernierProposePar: string;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.statut).toBe('EN_ATTENTE_CLIENT');
    expect(body.data.montantCourant).toBe(18500);
    expect(body.data.dernierProposePar).toBe('PRESTATAIRE');
  });

  it('PATCH /api/v1/negotiations/:id/accept lets the client accept the negotiation', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/negotiations/${negotiationId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { statut: string; montantAccepte: number };
    };

    expect(body.success).toBe(true);
    expect(body.data.statut).toBe('ACCEPTEE');
    expect(body.data.montantAccepte).toBe(18500);
  });

  it('POST /api/v1/negotiations allows a new proposal after a previous negotiation was accepted', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/negotiations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: negotiableServiceId,
        proposedAmount: 17500,
        message: 'Nouvelle proposition pour un autre creneau apres acceptation.',
      })
      .expect(201);

    const body = createResponse.body as {
      success: boolean;
      data: { id: string; statut: string };
    };

    acceptedFollowupNegotiationId = body.data.id;
    expect(body.success).toBe(true);
    expect(body.data.statut).toBe('EN_ATTENTE_PRESTATAIRE');

    await request(app.getHttpServer())
      .patch(`/api/v1/negotiations/${acceptedFollowupNegotiationId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        reason: 'Nettoyage du test de nouvelle proposition acceptee.',
      })
      .expect(200);
  });

  it('POST /api/v1/reservations/from-negotiation creates a reservation with the accepted amount', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations/from-negotiation')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        negotiationId,
        dateHeure: buildFutureIso(48),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 90,
        notes: 'Reservation issue de la negotiation acceptee.',
      })
      .expect(201);

    const body = response.body as {
      success: boolean;
      data: { prixConvenu: number; statut: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.prixConvenu).toBe(18500);
    expect(body.data.statut).toBe('EN_ATTENTE');

    const persistedNegotiation = await prisma.negotiation.findUniqueOrThrow({
      where: { id: negotiationId },
      select: { statut: true, reservationId: true },
    });

    expect(persistedNegotiation.statut).toBe('CONVERTIE_EN_RESERVATION');
    expect(persistedNegotiation.reservationId).toBe(body.data.id);

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: clientUserId,
        type: 'NOUVELLE_RESERVATION',
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(notification).not.toBeNull();
    expect(notification?.corps).toContain('Service negociable test');

    const emailOutboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'reservations.client.email-requested',
        payload: {
          path: ['reservationId'],
          equals: body.data.id,
        },
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(emailOutboxEvent).not.toBeNull();

    const negotiationOutboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'negotiations.converted',
        payload: {
          path: ['negotiationId'],
          equals: negotiationId,
        },
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(negotiationOutboxEvent).not.toBeNull();
    expect(
      (
        negotiationOutboxEvent?.payload as {
          reservationId?: string;
          clientId?: string;
        }
      ).reservationId,
    ).toBe(body.data.id);
    expect(
      (
        negotiationOutboxEvent?.payload as {
          reservationId?: string;
          clientId?: string;
        }
      ).clientId,
    ).toBe(clientUserId);

    const communicationRows = await prisma.communicationReservation.findMany({
      where: {
        reservationId: body.data.id,
        utilisateurId: clientUserId,
      },
      orderBy: { creeLe: 'asc' },
    });

    expect(communicationRows).toHaveLength(2);
    expect(communicationRows.map((row) => row.canal).sort()).toEqual([
      'EMAIL',
      'SMS',
    ]);
  });

  it('POST /api/v1/negotiations refuses non-negotiable services', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/negotiations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: fixedServiceId,
        proposedAmount: 21000,
        message: 'Je souhaite negocier ce service.',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Ce service ne permet pas la negotiation de prix.',
    );
  });

  it('POST /api/v1/negotiations refuses a duplicate active negotiation for the same client and service', async () => {
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/negotiations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: negotiableServiceId,
        proposedAmount: 15000,
        message: 'Nouvelle demande pour verifier le doublon.',
      })
      .expect(201);

    cancelledNegotiationId = (firstResponse.body as { data: { id: string } })
      .data.id;

    const duplicateResponse = await request(app.getHttpServer())
      .post('/api/v1/negotiations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: negotiableServiceId,
        proposedAmount: 14900,
        message: 'Je renvoie une autre proposition.',
      })
      .expect(409);

    expect(duplicateResponse.body.message).toBe(
      'Une negotiation active existe deja pour ce service et ce client.',
    );
  });

  it('PATCH /api/v1/negotiations/:id/cancel lets the client cancel an active negotiation', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/negotiations/${cancelledNegotiationId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        reason: 'Je ne suis plus disponible.',
      })
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { statut: string; raisonCloture: string | null };
    };

    expect(body.success).toBe(true);
    expect(body.data.statut).toBe('ANNULEE');
    expect(body.data.raisonCloture).toBe('Je ne suis plus disponible.');
  });

  it('PATCH /api/v1/negotiations/:id/reject lets the professional reject an active negotiation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/negotiations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: negotiableServiceId,
        proposedAmount: 16000,
        message: 'Derniere tentative de negotiation.',
      })
      .expect(201);

    rejectedNegotiationId = (createResponse.body as { data: { id: string } })
      .data.id;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/negotiations/${rejectedNegotiationId}/reject`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        reason: 'Le budget est trop bas.',
      })
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { statut: string; raisonCloture: string | null };
    };

    expect(body.success).toBe(true);
    expect(body.data.statut).toBe('REFUSEE');
    expect(body.data.raisonCloture).toBe('Le budget est trop bas.');
  });

  it('POST /api/v1/reservations/from-negotiation refuses an already converted negotiation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations/from-negotiation')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        negotiationId,
        dateHeure: buildFutureIso(72),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Cette negotiation est deja convertie en reservation.',
    );
  });
});
