import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { type AuthUser } from '../auth/security/auth-user.type';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard';
import { SearchRepository } from '../search/infrastructure/repositories/search.repository';
import { SearchQueryService } from '../search/application/services/search-query.service';
import { TenderMatchingService } from './tender-matching.service';
import { type TenderNotificationsService } from './tender-notifications.service';
import { TendersService } from './tenders.service';
import { TendersController } from './tenders.controller';

const databaseUrl = process.env.TEST_TENDERS_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite('Tender API on isolated PostgreSQL/PostGIS', () => {
  let prisma: PrismaService;
  let app: INestApplication;
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };
  const users = [
    'CLIENT',
    'PRESTATAIRE',
    'PRESTATAIRE',
    'CLIENT',
    'PRESTATAIRE',
  ].map((role) => ({
    sub: randomUUID(),
    role,
    phoneNumber: `+221${Math.floor(Math.random() * 1e12)}`,
  })) as AuthUser[];
  const categoryId = randomUUID();
  const profiles = [randomUUID(), randomUUID(), randomUUID()];
  const services = [randomUUID(), randomUUID(), randomUUID()];
  const input = {
    categoryId,
    description: 'Réparer une fuite sous le lavabo',
    address: 'Mermoz, Dakar',
    latitude: 14.69,
    longitude: -17.46,
    radiusKm: 10,
    proposedPrice: 10000,
  };
  const api = (index: number) => ({
    post: (url: string, body: unknown) =>
      request(app.getHttpServer())
        .post(`/tenders${url}`)
        .set('authorization', users[index].sub)
        .send(body),
    get: (url: string) =>
      request(app.getHttpServer())
        .get(`/tenders${url}`)
        .set('authorization', users[index].sub),
  });
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '15439' ||
      url.pathname !== '/jokko_tenders_test'
    )
      throw new Error('Refusing a non-isolated test database');
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.categorie.create({
      data: { id: categoryId, nom: `Plomberie test ${categoryId}` },
    });
    for (const user of users)
      await prisma.utilisateur.create({
        data: {
          id: user.sub,
          nom: user.role === 'CLIENT' ? 'Client test' : 'Prestataire test',
          role: user.role,
          numeroTelephone: user.phoneNumber,
        },
      });
    for (const [i, userIndex] of [1, 2, 4].entries()) {
      await prisma.profilProfessionnel.create({
        data: {
          id: profiles[i],
          utilisateurId: users[userIndex].sub,
          statutKyc: 'VERIFIE',
          ville: 'Dakar',
        },
      });
      await prisma.$executeRaw`UPDATE professional_profiles SET localisation = ST_SetSRID(ST_MakePoint(${i === 2 ? -16 : -17.461}, ${i === 2 ? 15.5 : 14.691}), 4326)::geography WHERE id = ${profiles[i]}::uuid`;
      await prisma.service.create({
        data: {
          id: services[i],
          profilProfessionnelId: profiles[i],
          categorieId: categoryId,
          nom: 'Plomberie',
          description: 'Réparation',
          prix: 15000,
          typePrix: 'NEGOCIABLE',
          modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
        },
      });
    }
    const service = new TendersService(
      prisma,
      new TenderMatchingService(
        new SearchQueryService(new SearchRepository(prisma)),
      ),
      notifications as unknown as TenderNotificationsService,
    );
    const module = await Test.createTestingModule({
      controllers: [TendersController],
      providers: [{ provide: TendersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: AuthUser;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = users.find(
            (user) => user.sub === req.headers.authorization,
          );
          return !!req.user;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);
  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await prisma.utilisateur.deleteMany({
        where: { id: { in: users.map((user) => user.sub) } },
      });
      await prisma.categorie.deleteMany({ where: { id: categoryId } });
      await prisma.$disconnect();
    }
  });

  it('publishes to nearby eligible providers and hides private data from unrelated users', async () => {
    const { body } = await api(0).post('', input).expect(201);
    expect(body.data.invitedCount).toBe(2);
    expect(notifications.send).toHaveBeenCalledWith(
      body.data.id,
      expect.arrayContaining([users[1].sub, users[2].sub]),
      expect.any(String),
      expect.any(String),
    );
    const pro = await api(1).get(`/${body.data.id}`).expect(200);
    expect(pro.body.data.responses).toHaveLength(1);
    expect(pro.body.data.responses[0].services[0].id).toBe(services[0]);
    await api(3).get(`/${body.data.id}`).expect(403);
    await api(4).get(`/${body.data.id}`).expect(403);
    await api(1).post('', input).expect(403);
    await api(0)
      .post('', { ...input, proposedPrice: -1 })
      .expect(400);
  });

  it('rejects stale revisions, unauthorized services and replies after cancellation', async () => {
    const created = (await api(0).post('', input)).body.data;
    await api(1)
      .post(`/${created.id}/respond`, {
        revision: 1,
        serviceId: services[1],
        amount: 10000,
      })
      .expect(403);
    await api(1)
      .post(`/${created.id}/respond`, {
        revision: 1,
        serviceId: services[0],
        amount: 12000,
      })
      .expect(201);
    const relaunched = await api(0)
      .post(`/${created.id}/republish`, { revision: 1, proposedPrice: 11000 })
      .expect(201);
    expect(relaunched.body.data.revision).toBe(2);
    expect(
      relaunched.body.data.responses.every(
        (response: { status: string }) => response.status === 'INVITED',
      ),
    ).toBe(true);
    await api(1)
      .post(`/${created.id}/respond`, {
        revision: 1,
        serviceId: services[0],
        amount: 11000,
      })
      .expect(409);
    await api(0).post(`/${created.id}/cancel`, { revision: 2 }).expect(201);
    await api(1)
      .post(`/${created.id}/respond`, {
        revision: 2,
        serviceId: services[0],
        amount: 11000,
      })
      .expect(409);
  });

  it('lets an invited provider make another offer after a client rejection', async () => {
    const tender = (await api(0).post('', input).expect(201)).body.data;
    const first = (await api(1).post(`/${tender.id}/respond`, {
      revision: 1,
      serviceId: services[0],
      amount: 12000,
    }).expect(201)).body.data.responses[0];
    await api(0).post(`/${tender.id}/responses/${first.id}/reject`, { revision: 1 }).expect(201);
    const second = (await api(1).post(`/${tender.id}/respond`, {
      revision: 1,
      serviceId: services[0],
      amount: 11000,
    }).expect(201)).body.data.responses[0];
    expect(second.status).toBe('OFFERED');
    expect(second.amount).toBe(11000);
    expect((await api(0).get(`/${tender.id}`).expect(200)).body.data.responses[0].amount).toBe(11000);
  });

  it('selects exactly one concurrent offer and creates one accepted booking-compatible negotiation', async () => {
    const tender = (await api(0).post('', input)).body.data;
    const response1 = (
      await api(1)
        .post(`/${tender.id}/respond`, {
          revision: 1,
          serviceId: services[0],
          amount: 10000,
        })
        .expect(201)
    ).body.data.responses[0];
    const response2 = (
      await api(2)
        .post(`/${tender.id}/respond`, {
          revision: 1,
          serviceId: services[1],
          amount: 12000,
        })
        .expect(201)
    ).body.data.responses[0];
    await api(0)
      .post(`/${tender.id}/responses/${response2.id}/select`, {
        revision: 1,
        amount: 11000,
      })
      .expect(409);
    const results = await Promise.all(
      [response1, response2].map((response) =>
        api(0).post(`/${tender.id}/responses/${response.id}/select`, {
          revision: 1,
          amount: response.amount,
        }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const selected = (
      await api(0).get(`/${tender.id}`)
    ).body.data.responses.filter(
      (response: { status: string }) => response.status === 'SELECTED',
    );
    expect(selected).toHaveLength(1);
    const negotiation = await prisma.negotiation.findUniqueOrThrow({
      where: { id: selected[0].negotiationId },
    });
    expect(negotiation.statut).toBe('ACCEPTEE');
    expect(Number(negotiation.montantAccepte)).toBe(selected[0].amount);
    expect(negotiation.adresseClientProposee).toBe(input.address);
    await api(0)
      .post(`/${tender.id}/responses/${selected[0].id}/select`, {
        revision: 1,
        amount: selected[0].amount,
      })
      .expect(201);
    expect(
      await prisma.negotiation.count({ where: { clientId: users[0].sub } }),
    ).toBe(1);
    await api(0)
      .post(`/${tender.id}/republish`, { revision: 1, proposedPrice: 15000 })
      .expect(409);
  });
});
