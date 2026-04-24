import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
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
          success?: boolean;
          data?: {
            statut?: string;
            baseDeDonnees?: string;
          };
        };
        expect(body.success).toBe(true);
        expect(['ok', 'erreur']).toContain(body.data?.statut);
        expect(['connectee', 'deconnectee']).toContain(
          body.data?.baseDeDonnees,
        );
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
