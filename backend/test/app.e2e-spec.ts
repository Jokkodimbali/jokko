import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/sante (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/sante')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          statut?: string;
          baseDeDonnees?: string;
        };
        expect(['ok', 'erreur']).toContain(body.statut);
        expect(['connectee', 'deconnectee']).toContain(body.baseDeDonnees);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
