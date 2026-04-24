import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoleUtilisateur, StatutKyc } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SearchModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let verifiedProfileId = '';
  let secondVerifiedProfileId = '';
  let unverifiedProfileId = '';
  let categoryId = '';
  let secondCategoryId = '';

  const timestamp = Date.now();

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

    categoryId = (
      await prisma.categorie.create({
        data: {
          nom: `Plomberie Search ${timestamp}`,
          ordreTri: 1,
        },
      })
    ).id;

    secondCategoryId = (
      await prisma.categorie.create({
        data: {
          nom: `Electricite Search ${timestamp}`,
          ordreTri: 2,
        },
      })
    ).id;

    const verifiedUser = await prisma.utilisateur.create({
      data: {
        numeroTelephone: `+22170${String(timestamp).slice(-7)}`,
        nom: 'Plombier Dakar',
        email: `search-verified-${timestamp}@jokko.sn`,
        role: RoleUtilisateur.PRESTATAIRE,
      },
    });

    const unverifiedUser = await prisma.utilisateur.create({
      data: {
        numeroTelephone: `+22171${String(timestamp).slice(-7)}`,
        nom: 'Prestataire Cache',
        email: `search-hidden-${timestamp}@jokko.sn`,
        role: RoleUtilisateur.PRESTATAIRE,
      },
    });

    const secondVerifiedUser = await prisma.utilisateur.create({
      data: {
        numeroTelephone: `+22172${String(timestamp).slice(-7)}`,
        nom: 'Electricien Thies',
        email: `search-second-${timestamp}@jokko.sn`,
        role: RoleUtilisateur.PRESTATAIRE,
      },
    });

    verifiedProfileId = (
      await prisma.profilProfessionnel.create({
        data: {
          utilisateurId: verifiedUser.id,
          biographie: 'Plombier disponible 24h/24 a Dakar.',
          nomEntreprise: 'Jokko Plomberie',
          ville: 'Dakar',
          statutKyc: StatutKyc.VERIFIE,
        },
      })
    ).id;

    unverifiedProfileId = (
      await prisma.profilProfessionnel.create({
        data: {
          utilisateurId: unverifiedUser.id,
          biographie: 'Prestataire non verifie.',
          nomEntreprise: 'Cache Services',
          ville: 'Dakar',
          statutKyc: StatutKyc.EN_ATTENTE,
        },
      })
    ).id;

    secondVerifiedProfileId = (
      await prisma.profilProfessionnel.create({
        data: {
          utilisateurId: secondVerifiedUser.id,
          biographie: 'Electricien disponible a Thies.',
          nomEntreprise: 'Jokko Electricite',
          ville: 'Thies',
          statutKyc: StatutKyc.VERIFIE,
        },
      })
    ).id;

    await prisma.service.create({
      data: {
        profilProfessionnelId: verifiedProfileId,
        categorieId: categoryId,
        nom: 'Debouchage urgent',
        description: 'Intervention rapide plomberie sur Dakar.',
        prix: 15000,
        typePrix: 'FIXE',
      },
    });

    await prisma.service.create({
      data: {
        profilProfessionnelId: unverifiedProfileId,
        categorieId: categoryId,
        nom: 'Fuite eau',
        description: 'Ce service ne doit pas apparaitre dans la recherche.',
        prix: 12000,
        typePrix: 'FIXE',
      },
    });

    await prisma.service.create({
      data: {
        profilProfessionnelId: secondVerifiedProfileId,
        categorieId: secondCategoryId,
        nom: 'Installation tableau electrique',
        description: 'Intervention electricite a Thies.',
        prix: 20000,
        typePrix: 'FIXE',
      },
    });

    await prisma.$executeRaw`
      UPDATE professional_profiles
      SET localisation = ST_SetSRID(ST_MakePoint(-17.4677, 14.7167), 4326)::geography
      WHERE id = ${verifiedProfileId}::uuid
    `;

    await prisma.$executeRaw`
      UPDATE professional_profiles
      SET localisation = ST_SetSRID(ST_MakePoint(-17.6000, 14.9000), 4326)::geography
      WHERE id = ${unverifiedProfileId}::uuid
    `;

    await prisma.$executeRaw`
      UPDATE professional_profiles
      SET localisation = ST_SetSRID(ST_MakePoint(-16.9256, 14.7910), 4326)::geography
      WHERE id = ${secondVerifiedProfileId}::uuid
    `;
  });

  afterAll(async () => {
    const profileIds = [
      verifiedProfileId,
      secondVerifiedProfileId,
      unverifiedProfileId,
    ].filter((value) => value.length > 0);
    const categoryIds = [categoryId, secondCategoryId].filter(
      (value) => value.length > 0,
    );

    await prisma.service.deleteMany({
      where: {
        profilProfessionnelId: {
          in: profileIds,
        },
      },
    });
    await prisma.profilProfessionnel.deleteMany({
      where: {
        id: { in: profileIds },
      },
    });
    await prisma.utilisateur.deleteMany({
      where: {
        email: {
          in: [
            `search-verified-${timestamp}@jokko.sn`,
            `search-second-${timestamp}@jokko.sn`,
            `search-hidden-${timestamp}@jokko.sn`,
          ],
        },
      },
    });
    await prisma.categorie.deleteMany({
      where: {
        id: { in: categoryIds },
      },
    });
    await app.close();
  });

  it('GET /api/v1/search/professionals retourne les professionnels verifies filtres par geolocalisation', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search/professionals')
      .query({
        latitude: 14.7167,
        longitude: -17.4677,
        radiusKm: 10,
        categoryId,
        query: 'plombier',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      'Resultats de recherche recuperes avec succes.',
    );
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(verifiedProfileId);
    expect(response.body.data[0].city).toBe('Dakar');
    expect(response.body.data[0].services[0].categoryId).toBe(categoryId);
    expect(response.body.meta.pagination.total).toBe(1);
  });

  it('GET /api/v1/search/professionals filtre correctement par ville seule', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search/professionals')
      .query({
        city: 'Thies',
        categoryId: secondCategoryId,
        query: 'electricien',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(secondVerifiedProfileId);
    expect(response.body.data[0].city).toBe('Thies');
  });

  it('GET /api/v1/search/professionals filtre correctement par categorie seule', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search/professionals')
      .query({
        categoryId: secondCategoryId,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(secondVerifiedProfileId);
    expect(response.body.data[0].services[0].categoryId).toBe(secondCategoryId);
  });

  it('GET /api/v1/search/professionals retourne 400 si radiusKm est invalide', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search/professionals')
      .query({
        latitude: 14.7167,
        longitude: -17.4677,
        radiusKm: 0,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      'Le rayon de recherche doit etre un nombre positif inferieur ou egal a 100.',
    );
  });

  it('GET /api/v1/professionals reutilise la meme logique de recherche publique', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({
        categoryId,
        query: 'plombier',
        latitude: 14.7167,
        longitude: -17.4677,
        radiusKm: 10,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      'Resultats de recherche recuperes avec succes.',
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(verifiedProfileId);
  });

  it('GET /api/v1/search/professionals retourne 400 si latitude sans longitude', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search/professionals')
      .query({
        latitude: 14.7167,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe('SEARCH_COORDINATES_PAIR_REQUIRED');
  });
});
