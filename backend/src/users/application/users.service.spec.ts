import { RoleUtilisateur, StatutReservation, TypePrix } from '@prisma/client';
import { appMessage } from '../../core/http/app-http.exception';
import { UsersService } from './services/users.service';

describe('UsersService', () => {
  const usersRepository = {
    findMeById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhoneNumber: jest.fn(),
    updateMeById: jest.fn(),
    anonymizeAndRevokeById: jest.fn(),
    listClientHistory: jest.fn(),
    findPasswordHashById: jest.fn(),
    updatePasswordHashById: jest.fn(),
  };
  const passwordHashService = {
    compare: jest.fn(),
    hash: jest.fn(),
  };
  const phoneNumberValidator = {
    normalizeOrThrow: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      usersRepository as never,
      passwordHashService as never,
      phoneNumberValidator as never,
    );
  });

  it('me should return current user profile', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });

    const result = await service.me('u1');
    expect(result.id).toBe('u1');
  });

  it('updateMe should fail with empty payload', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });

    await expect(service.updateMe('u1', {})).rejects.toMatchObject({
      message: appMessage('USERS_UPDATE_EMPTY').message,
    });
  });

  it('updateMe should fail if email is already used', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.findByEmail.mockResolvedValue({ id: 'u2' });

    await expect(
      service.updateMe('u1', { email: 'used@example.com' }),
    ).rejects.toMatchObject({
      message: appMessage('USERS_EMAIL_ALREADY_USED').message,
    });
  });

  it('updateMe should update phone number after normalization', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    phoneNumberValidator.normalizeOrThrow.mockReturnValue('+221710000000');
    usersRepository.findByPhoneNumber.mockResolvedValue(null);
    usersRepository.updateMeById.mockResolvedValue({
      status: 'updated',
      user: {
        id: 'u1',
        numeroTelephone: '+221710000000',
        nom: 'Test',
        email: null,
        adresse: null,
        role: RoleUtilisateur.CLIENT,
        urlAvatar: null,
        estActif: true,
        creeLe: new Date(),
      },
    });

    const result = await service.updateMe('u1', {
      phoneNumber: '71 000 00 00',
    });

    expect(phoneNumberValidator.normalizeOrThrow).toHaveBeenCalledWith(
      '71 000 00 00',
    );
    expect(usersRepository.findByPhoneNumber).toHaveBeenCalledWith(
      '+221710000000',
    );
    expect(usersRepository.updateMeById).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ numeroTelephone: '+221710000000' }),
    );
    expect(result.numeroTelephone).toBe('+221710000000');
  });

  it('updateMe should fail if phone number is already used', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    phoneNumberValidator.normalizeOrThrow.mockReturnValue('+221710000000');
    usersRepository.findByPhoneNumber.mockResolvedValue({ id: 'u2' });

    await expect(
      service.updateMe('u1', { phoneNumber: '71 000 00 00' }),
    ).rejects.toMatchObject({
      message: appMessage('AUTH_PHONE_ALREADY_USED').message,
    });
    expect(usersRepository.updateMeById).not.toHaveBeenCalled();
  });

  it('anonymizeMe should revoke sessions and anonymize user', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: 'test@example.com',
      adresse: 'Dakar',
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.anonymizeAndRevokeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: 'del-u1-1234',
      nom: 'Utilisateur supprime',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: false,
      creeLe: new Date(),
    });

    await service.anonymizeMe('u1');

    expect(usersRepository.anonymizeAndRevokeById).toHaveBeenCalled();
  });

  it('updateMe should fail when repository reports email conflict', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.updateMeById.mockResolvedValue({
      status: 'email_conflict',
    });

    await expect(
      service.updateMe('u1', { email: 'used@example.com' }),
    ).rejects.toMatchObject({
      message: appMessage('USERS_EMAIL_ALREADY_USED').message,
    });
  });

  it('updateMyAvatar should update avatar url', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.updateMeById.mockResolvedValue({
      status: 'updated',
      user: {
        id: 'u1',
        numeroTelephone: '+221770000000',
        nom: 'Test',
        email: null,
        adresse: null,
        role: RoleUtilisateur.CLIENT,
        urlAvatar: 'https://cdn.jokko.sn/new-avatar.png',
        estActif: true,
        creeLe: new Date(),
      },
    });

    const result = await service.updateMyAvatar('u1', {
      avatarUrl: 'https://cdn.jokko.sn/new-avatar.png',
    });
    expect(result.urlAvatar).toBe('https://cdn.jokko.sn/new-avatar.png');
  });

  it('getMyHistory should return booking history list', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.listClientHistory.mockResolvedValue([
      {
        id: 'b1',
        statut: StatutReservation.EN_ATTENTE,
        planifieeLe: new Date(),
        adresseClient: 'Dakar',
        prixAccorde: 10000,
        creeLe: new Date(),
        service: {
          id: 's1',
          nom: 'Plomberie',
          prix: 10000,
          typePrix: TypePrix.FIXE,
        },
      },
    ]);

    const result = await service.getMyHistory('u1', { limit: 10 });
    expect(result).toHaveLength(1);
    expect(usersRepository.listClientHistory).toHaveBeenCalledWith('u1', 10);
  });

  it('changeMyPassword should verify current password and store a new hash', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Test',
      email: null,
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.findPasswordHashById.mockResolvedValue('old-hash');
    passwordHashService.compare.mockResolvedValue(true);
    passwordHashService.hash.mockResolvedValue('new-hash');
    usersRepository.updatePasswordHashById.mockResolvedValue(true);

    await service.changeMyPassword('u1', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(passwordHashService.compare).toHaveBeenCalledWith(
      'old-password',
      'old-hash',
    );
    expect(usersRepository.updatePasswordHashById).toHaveBeenCalledWith(
      'u1',
      'new-hash',
    );
  });

  it('changeMyPassword should create first local password when no password exists', async () => {
    usersRepository.findMeById.mockResolvedValue({
      id: 'u1',
      numeroTelephone: '+221770000000',
      nom: 'Google User',
      email: 'google@jokko.sn',
      adresse: null,
      role: RoleUtilisateur.CLIENT,
      urlAvatar: null,
      estActif: true,
      creeLe: new Date(),
    });
    usersRepository.findPasswordHashById.mockResolvedValue(null);
    passwordHashService.hash.mockResolvedValue('new-local-hash');
    usersRepository.updatePasswordHashById.mockResolvedValue(true);

    await service.changeMyPassword('u1', {
      newPassword: 'new-password',
    });

    expect(passwordHashService.compare).not.toHaveBeenCalled();
    expect(usersRepository.updatePasswordHashById).toHaveBeenCalledWith(
      'u1',
      'new-local-hash',
    );
  });
});
