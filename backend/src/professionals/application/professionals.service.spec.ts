import { RoleUtilisateur, StatutKyc } from '@prisma/client';
import { appMessage } from '../../core/http/app-http.exception';
import { ProfessionalsService } from './services/professionals.service';

describe('ProfessionalsService', () => {
  const professionalsRepository = {
    createProfile: jest.fn(),
    findByUserId: jest.fn(),
    updateProfile: jest.fn(),
    submitKyc: jest.fn(),
    approveKyc: jest.fn(),
    rejectKyc: jest.fn(),
    findVerifiedById: jest.fn(),
    listVerified: jest.fn(),
    listServices: jest.fn(),
    listPortfolio: jest.fn(),
    listAvailabilities: jest.fn(),
    listReviews: jest.fn(),
    createService: jest.fn(),
    updateService: jest.fn(),
    disableService: jest.fn(),
    createPortfolioItem: jest.fn(),
    deletePortfolioItem: jest.fn(),
    createAvailability: jest.fn(),
    disableAvailability: jest.fn(),
  };

  let service: ProfessionalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfessionalsService(professionalsRepository as never);
  });

  it('should create professional profile for PRESTATAIRE', async () => {
    professionalsRepository.createProfile.mockResolvedValue({
      status: 'created',
      profile: {
        id: 'p1',
        utilisateurId: 'u1',
        biographie: 'Bio',
        nomEntreprise: 'Entreprise',
        urlPieceIdentite: null,
        statutKyc: StatutKyc.EN_ATTENTE,
        raisonRejetKyc: null,
        ville: 'Dakar',
        noteGlobale: 0,
        nombreAvis: 0,
        creeLe: new Date(),
        utilisateur: {
          id: 'u1',
          nom: 'Pro User',
          numeroTelephone: '+221770000000',
          urlAvatar: null,
          estActif: true,
        },
      },
    });

    const result = await service.createProfile(
      {
        sub: 'u1',
        role: RoleUtilisateur.PRESTATAIRE,
        phoneNumber: '+221770000000',
      },
      {
        bio: 'Bio',
        companyName: 'Entreprise',
        city: 'Dakar',
      },
    );

    expect(result.id).toBe('p1');
  });

  it('should reject CLIENT role for professional actions', async () => {
    await expect(
      service.createProfile(
        {
          sub: 'u1',
          role: RoleUtilisateur.CLIENT,
          phoneNumber: '+221770000000',
        },
        {
          bio: 'Bio',
        },
      ),
    ).rejects.toMatchObject({
      message: appMessage('PROFESSIONALS_FORBIDDEN_ROLE').message,
    });
  });

  it('should throw not found for missing verified profile', async () => {
    professionalsRepository.findVerifiedById.mockResolvedValue(null);

    await expect(service.getProfessionalById('missing')).rejects.toMatchObject({
      message: appMessage('PROFESSIONALS_PROFILE_NOT_FOUND').message,
    });
  });

  it('should reject non-admin role for approve KYC', async () => {
    await expect(
      service.approveKyc(
        {
          sub: 'u1',
          role: RoleUtilisateur.PRESTATAIRE,
          phoneNumber: '+221770000000',
        },
        'p1',
      ),
    ).rejects.toMatchObject({
      message: appMessage('PROFESSIONALS_ADMIN_FORBIDDEN_ROLE').message,
    });
  });

  it('should reject empty update payload', async () => {
    await expect(
      service.updateMyProfile(
        {
          sub: 'u1',
          role: RoleUtilisateur.PRESTATAIRE,
          phoneNumber: '+221770000000',
        },
        {},
      ),
    ).rejects.toMatchObject({
      message: appMessage('USERS_UPDATE_EMPTY').message,
    });
  });
});
