import { RoleUtilisateur } from '@prisma/client';
import { appMessage } from '../../core/http/app-http.exception';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authRepository = {
    findByPhoneNumber: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    createClientByPhoneNumber: jest.fn(),
    createClientWithPassword: jest.fn(),
    findWithPasswordByPhoneNumber: jest.fn(),
    findPublicProfileById: jest.fn(),
    linkGoogleIdentity: jest.fn(),
  };
  const otpService = {
    create: jest.fn(),
    verify: jest.fn(),
  };
  const jwtTokenService = {
    issueTokens: jest.fn(),
    getRefreshTokenExpiryDate: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const phoneNumberValidator = {
    normalizeOrThrow: jest.fn((value: string) => value),
  };
  const passwordHashService = {
    hash: jest.fn(),
    compare: jest.fn(),
  };
  const refreshSessionService = {
    persist: jest.fn(),
    assertValid: jest.fn(),
    revoke: jest.fn(),
    rotate: jest.fn(),
  };
  const googleAuthService = {
    verifyIdToken: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      authRepository as never,
      otpService as never,
      jwtTokenService as never,
      phoneNumberValidator as never,
      passwordHashService as never,
      refreshSessionService as never,
      googleAuthService as never,
    );
  });

  it('register should create a new user and issue tokens', async () => {
    authRepository.findByPhoneNumber.mockResolvedValue(null);
    passwordHashService.hash.mockResolvedValue('hashed');
    authRepository.createClientWithPassword.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      role: RoleUtilisateur.CLIENT,
    });
    jwtTokenService.issueTokens.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });
    jwtTokenService.getRefreshTokenExpiryDate.mockReturnValue(new Date());

    const result = await service.register({
      phoneNumber: '+221770000000',
      name: 'Test',
      password: 'Password123',
    });

    expect(result.success).toBe(true);
    expect(authRepository.createClientWithPassword).toHaveBeenCalled();
    expect(refreshSessionService.persist).toHaveBeenCalled();
  });

  it('register should fail when phone number already exists', async () => {
    authRepository.findByPhoneNumber.mockResolvedValue({ id: 'exists' });

    await expect(
      service.register({
        phoneNumber: '+221770000000',
        name: 'Test',
        password: 'Password123',
      }),
    ).rejects.toMatchObject({
      message: appMessage('AUTH_PHONE_ALREADY_USED').message,
    });
  });

  it('login should fail when password is invalid', async () => {
    authRepository.findWithPasswordByPhoneNumber.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      role: RoleUtilisateur.CLIENT,
      motDePasseHash: 'hashed',
    });
    passwordHashService.compare.mockResolvedValue(false);

    await expect(
      service.login({
        phoneNumber: '+221770000000',
        password: 'wrongpassword',
      }),
    ).rejects.toMatchObject({
      message: appMessage('AUTH_INVALID_CREDENTIALS').message,
    });
  });

  it('refresh should rotate tokens from a valid session', async () => {
    refreshSessionService.assertValid.mockResolvedValue({
      id: 's1',
      utilisateurId: 'u1',
      expireLe: new Date(Date.now() + 10_000),
    });
    jwtTokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'u1',
      role: RoleUtilisateur.CLIENT,
      phoneNumber: '+221770000000',
    });
    authRepository.findById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      role: RoleUtilisateur.CLIENT,
    });
    jwtTokenService.issueTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    jwtTokenService.getRefreshTokenExpiryDate.mockReturnValue(new Date());

    const result = await service.refresh('old-refresh');

    expect(result.success).toBe(true);
    expect(refreshSessionService.rotate).toHaveBeenCalled();
  });
});
