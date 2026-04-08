import { Test, TestingModule } from '@nestjs/testing';
import { DOMAINE_EVENT_BUS } from './core/events/domaine-event-bus.port';
import { ObtenirEtatSanteUseCase } from './sante/application/obtenir-etat-sante.use-case';
import { VERIFICATEUR_BASE_PORT } from './sante/domaine/ports/verificateur-base.port';
import { SanteController } from './sante/presentation/sante.controller';

describe('SanteController', () => {
  let santeController: SanteController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SanteController],
      providers: [
        ObtenirEtatSanteUseCase,
        {
          provide: VERIFICATEUR_BASE_PORT,
          useValue: {
            verifierConnexion: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: DOMAINE_EVENT_BUS,
          useValue: {
            publier: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    santeController = app.get<SanteController>(SanteController);
  });

  describe('sante', () => {
    it('should return health status', async () => {
      await expect(santeController.getEtatSante()).resolves.toMatchObject({
        statut: 'ok',
        baseDeDonnees: 'connectee',
      });
    });
  });
});
