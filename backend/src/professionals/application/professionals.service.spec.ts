import { RoleUtilisateur, StatutKyc } from '@prisma/client';
import { appMessage } from '../../core/http/app-http.exception';
import { ProfileService } from './services/profile.service';
import { KycService } from './services/kyc.service';
import { ServiceManagementService } from './services/service-management.service';
import { PortfolioService } from './services/portfolio.service';
import { AvailabilityService } from './services/availability.service';

// ─── Test Helpers (DRY) ──────────────────────────────────────────────────────

const createMockAuthUser = (
  role: RoleUtilisateur = RoleUtilisateur.PRESTATAIRE,
  sub: string = 'user-123',
  phoneNumber: string = '+221770000000',
) => ({
  sub,
  role,
  phoneNumber,
});

const createMockProfileView = (overrides: Record<string, unknown> = {}) => ({
  id: 'profile-123',
  utilisateurId: 'user-123',
  biographie: 'Bio professionnelle',
  nomEntreprise: 'Entreprise SARL',
  urlPieceIdentiteRecto: null,
  urlPieceIdentiteVerso: null,
  statutKyc: StatutKyc.EN_ATTENTE,
  raisonRejetKyc: null,
  ville: 'Dakar',
  noteGlobale: 0,
  nombreAvis: 0,
  creeLe: new Date(),
  utilisateur: {
    id: 'user-123',
    nom: 'John Doe',
    numeroTelephone: '+221770000000',
    urlAvatar: null,
    estActif: true,
  },
  ...overrides,
});

// ─── ProfileService Tests ────────────────────────────────────────────────────

describe('ProfileService', () => {
  const mockRepository = {
    createProfile: jest.fn(),
    findByUserId: jest.fn(),
    updateProfile: jest.fn(),
    findVerifiedById: jest.fn(),
    findPublicById: jest.fn(),
    listVerified: jest.fn(),
  };

  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileService(mockRepository as never);
  });

  describe('createProfile', () => {
    it('should create professional profile for PRESTATAIRE', async () => {
      const mockProfile = createMockProfileView({
        statutKyc: StatutKyc.EN_ATTENTE,
      });
      mockRepository.createProfile.mockResolvedValue({
        status: 'created',
        profile: mockProfile,
      });

      const result = await service.createProfile(
        createMockAuthUser(RoleUtilisateur.PRESTATAIRE),
        {
          bio: 'Bio professionnelle',
          companyName: 'Entreprise SARL',
          city: 'Dakar',
        },
      );

      expect(result.id).toBe('profile-123');
      expect(mockRepository.createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          utilisateurId: 'user-123',
        }),
      );
    });

    it('should throw when profile already exists', async () => {
      mockRepository.createProfile.mockResolvedValue({
        status: 'already_exists',
      });

      await expect(
        service.createProfile(createMockAuthUser(), { bio: 'Bio' }),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_PROFILE_ALREADY_EXISTS').message,
      });
    });
  });

  describe('getMyProfile', () => {
    it('should return profile when found', async () => {
      const mockProfile = createMockProfileView();
      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await service.getMyProfile(createMockAuthUser());

      expect(result).toEqual(mockProfile);
    });

    it('should throw when profile not found', async () => {
      mockRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.getMyProfile(createMockAuthUser()),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_PROFILE_NOT_FOUND').message,
      });
    });
  });

  describe('updateMyProfile', () => {
    it('should update profile successfully', async () => {
      const mockProfile = createMockProfileView({
        biographie: 'Nouvelle bio',
      });
      mockRepository.updateProfile.mockResolvedValue({
        status: 'updated',
        profile: mockProfile,
      });

      const result = await service.updateMyProfile(createMockAuthUser(), {
        bio: 'Nouvelle bio',
      });

      expect(result.biographie).toBe('Nouvelle bio');
    });

    it('should throw when update payload is empty', async () => {
      await expect(
        service.updateMyProfile(createMockAuthUser(), {}),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_UPDATE_EMPTY').message,
      });
    });
  });

  describe('getProfessionalById', () => {
    it('should return profile when found', async () => {
      const mockProfile = createMockProfileView({
        statutKyc: StatutKyc.VERIFIE,
      });
      mockRepository.findPublicById.mockResolvedValue(mockProfile);

      const result = await service.getProfessionalById('profile-123');

      expect(result).toEqual(mockProfile);
    });

    it('should throw when profile not found', async () => {
      mockRepository.findPublicById.mockResolvedValue(null);

      await expect(
        service.getProfessionalById('missing'),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_PROFILE_NOT_FOUND').message,
      });
    });
  });
});

// ─── KycService Tests ────────────────────────────────────────────────────────

describe('KycService', () => {
  const mockRepository = {
    submitKyc: jest.fn(),
    approveKyc: jest.fn(),
    rejectKyc: jest.fn(),
    findByUserId: jest.fn(),
  };

  let service: KycService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KycService(mockRepository as never);
  });

  describe('submitKyc', () => {
    it('should submit KYC successfully', async () => {
      const mockProfile = createMockProfileView({
        statutKyc: StatutKyc.EN_ATTENTE,
        urlPieceIdentiteRecto: 'https://example.com/cni.jpg',
      });
      mockRepository.submitKyc.mockResolvedValue({
        status: 'updated',
        profile: mockProfile,
      });

      const result = await service.submitKyc(createMockAuthUser(), {
        idCardUrl: 'https://example.com/cni.jpg',
      });

      expect(result.urlPieceIdentiteRecto).toBe('https://example.com/cni.jpg');
    });

    it('should throw when profile not found', async () => {
      mockRepository.submitKyc.mockResolvedValue({
        status: 'profile_not_found',
      });

      await expect(
        service.submitKyc(createMockAuthUser(), {
          idCardUrl: 'https://example.com/cni.jpg',
        }),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_PROFILE_NOT_FOUND').message,
      });
    });
  });

  describe('approveKyc', () => {
    it('should approve KYC for ADMIN', async () => {
      const mockProfile = createMockProfileView({
        statutKyc: StatutKyc.VERIFIE,
      });
      mockRepository.approveKyc.mockResolvedValue({
        status: 'approved',
        profile: mockProfile,
      });

      const result = await service.approveKyc(
        createMockAuthUser(RoleUtilisateur.ADMIN),
        'profile-123',
      );

      expect(result.statutKyc).toBe(StatutKyc.VERIFIE);
    });

    it('should reject non-ADMIN role', async () => {
      await expect(
        service.approveKyc(
          createMockAuthUser(RoleUtilisateur.PRESTATAIRE),
          'profile-123',
        ),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_ADMIN_FORBIDDEN_ROLE').message,
      });
    });
  });

  describe('rejectKyc', () => {
    it('should reject KYC for ADMIN with reason', async () => {
      const mockProfile = createMockProfileView({
        statutKyc: StatutKyc.REJETE,
        raisonRejetKyc: 'Document illisible',
      });
      mockRepository.rejectKyc.mockResolvedValue({
        status: 'rejected',
        profile: mockProfile,
      });

      const result = await service.rejectKyc(
        createMockAuthUser(RoleUtilisateur.ADMIN),
        'profile-123',
        { reason: 'Document illisible' },
      );

      expect(result.raisonRejetKyc).toBe('Document illisible');
    });

    it('should reject non-ADMIN role', async () => {
      await expect(
        service.rejectKyc(
          createMockAuthUser(RoleUtilisateur.PRESTATAIRE),
          'profile-123',
          { reason: 'Document illisible' },
        ),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_ADMIN_FORBIDDEN_ROLE').message,
      });
    });
  });
});

// ─── ServiceManagementService Tests ──────────────────────────────────────────

describe('ServiceManagementService', () => {
  const mockRepository = {
    createService: jest.fn(),
    updateService: jest.fn(),
    disableService: jest.fn(),
    listServices: jest.fn(),
    findByUserId: jest.fn(),
    findVerifiedById: jest.fn(),
  };

  let service: ServiceManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceManagementService(mockRepository as never);
  });

  describe('createService', () => {
    it('should create service when KYC is verified', async () => {
      mockRepository.findByUserId.mockResolvedValue(
        createMockProfileView({ statutKyc: StatutKyc.VERIFIE }),
      );
      mockRepository.createService.mockResolvedValue({
        status: 'created',
        service: {
          id: 'service-123',
          nom: 'Service test',
          description: 'Description',
          prix: 50000,
          typePrix: 'FIXE',
          estDisponible: true,
          creeLe: new Date(),
        },
      });

      const result = await service.createService(createMockAuthUser(), {
        categoryId: 'cat-123',
        name: 'Service test',
        description: 'Description',
        price: 50000,
        priceType: 'FIXE',
      });

      expect(result.nom).toBe('Service test');
    });

    it('should throw when KYC is not verified', async () => {
      mockRepository.findByUserId.mockResolvedValue(
        createMockProfileView({ statutKyc: StatutKyc.EN_ATTENTE }),
      );

      await expect(
        service.createService(createMockAuthUser(), {
          categoryId: 'cat-123',
          name: 'Service test',
          description: 'Description',
          price: 50000,
          priceType: 'FIXE',
        }),
      ).rejects.toMatchObject({
        message: appMessage('PROFESSIONALS_KYC_NOT_VERIFIED').message,
      });
    });
  });
});

// ─── PortfolioService Tests ──────────────────────────────────────────────────

describe('PortfolioService', () => {
  const mockRepository = {
    createPortfolioItem: jest.fn(),
    deletePortfolioItem: jest.fn(),
    listPortfolio: jest.fn(),
    findVerifiedById: jest.fn(),
  };

  let service: PortfolioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PortfolioService(mockRepository as never);
  });

  describe('createItem', () => {
    it('should create portfolio item', async () => {
      mockRepository.createPortfolioItem.mockResolvedValue({
        status: 'created',
        item: {
          id: 'item-123',
          titre: 'Projet test',
          description: 'Description',
          urlImage: 'https://example.com/image.jpg',
          creeLe: new Date(),
        },
      });

      const result = await service.createItem(createMockAuthUser(), {
        title: 'Projet test',
        description: 'Description',
        imageUrl: 'https://example.com/image.jpg',
      });

      expect(result.titre).toBe('Projet test');
    });
  });

  describe('deleteItem', () => {
    it('should delete portfolio item', async () => {
      mockRepository.deletePortfolioItem.mockResolvedValue({
        status: 'deleted',
      });

      const result = await service.deleteItem(createMockAuthUser(), 'item-123');

      expect(result).toEqual({ success: true });
    });
  });
});

// ─── AvailabilityService Tests ───────────────────────────────────────────────

describe('AvailabilityService', () => {
  const mockRepository = {
    createAvailability: jest.fn(),
    updateAvailability: jest.fn(),
    disableAvailability: jest.fn(),
    listAvailabilities: jest.fn(),
    findVerifiedById: jest.fn(),
  };

  let service: AvailabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AvailabilityService(mockRepository as never);
  });

  describe('createAvailability', () => {
    it('should create availability slot', async () => {
      mockRepository.createAvailability.mockResolvedValue({
        status: 'created',
        availability: {
          id: 'avail-123',
          jourSemaine: 1,
          heureDebut: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
          heureFin: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
          estActive: true,
        },
      });

      const result = await service.createAvailability(createMockAuthUser(), {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      });

      expect(result.jourSemaine).toBe(1);
    });

    it('should throw on invalid time format', async () => {
      await expect(
        service.createAvailability(createMockAuthUser(), {
          dayOfWeek: 1,
          startTime: '99:99',
          endTime: '17:00',
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateAvailability', () => {
    it('should update an existing availability slot', async () => {
      mockRepository.updateAvailability.mockResolvedValue({
        status: 'updated',
        availability: {
          id: 'avail-123',
          jourSemaine: 2,
          heureDebut: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
          heureFin: new Date(Date.UTC(1970, 0, 1, 16, 0, 0)),
          estActive: true,
        },
      });

      const result = await service.updateAvailability(
        createMockAuthUser(),
        'avail-123',
        {
          dayOfWeek: 2,
          startTime: '10:00',
          endTime: '16:00',
        },
      );

      expect(result.jourSemaine).toBe(2);
      expect(mockRepository.updateAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          utilisateurId: 'user-123',
          availabilityId: 'avail-123',
          dayOfWeek: 2,
        }),
      );
    });
  });
});
