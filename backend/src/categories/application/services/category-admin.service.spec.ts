import { RoleUtilisateur } from '@prisma/client';
import { appMessage } from '../../../core/http/app-http.exception';
import { CategoryAdminService } from './category-admin.service';

describe('CategoryAdminService', () => {
  const categoriesRepository = {
    listActive: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    disable: jest.fn(),
  };

  let service: CategoryAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CategoryAdminService(categoriesRepository as never);
  });

  it('should create a category when payload is valid', async () => {
    categoriesRepository.findByName.mockResolvedValue(null);
    categoriesRepository.create.mockResolvedValue({
      status: 'created',
      category: {
        id: 'cat-1',
        nom: 'Plomberie',
        urlIcone: 'https://cdn.jokko.sn/plomberie.png',
        ordreTri: 1,
        estActive: true,
      },
    });

    const result = await service.createCategory(
      {
        sub: 'admin-1',
        role: RoleUtilisateur.ADMIN,
        phoneNumber: '+221770000000',
      },
      {
        name: ' Plomberie ',
        iconUrl: 'https://cdn.jokko.sn/plomberie.png',
        sortOrder: 1,
      },
    );

    expect(result.nom).toBe('Plomberie');
    expect(categoriesRepository.create).toHaveBeenCalledWith({
      name: 'Plomberie',
      iconUrl: 'https://cdn.jokko.sn/plomberie.png',
      sortOrder: 1,
    });
  });

  it('should reject duplicate category names', async () => {
    categoriesRepository.findByName.mockResolvedValue({ id: 'cat-existing' });

    await expect(
      service.createCategory(
        {
          sub: 'admin-1',
          role: RoleUtilisateur.ADMIN,
          phoneNumber: '+221770000000',
        },
        {
          name: 'Plomberie',
        },
      ),
    ).rejects.toMatchObject({
      message: appMessage('CATEGORIES_NAME_ALREADY_USED').message,
    });
  });

  it('should reject empty update payloads', async () => {
    await expect(
      service.updateCategory(
        {
          sub: 'admin-1',
          role: RoleUtilisateur.ADMIN,
          phoneNumber: '+221770000000',
        },
        'cat-1',
        {},
      ),
    ).rejects.toMatchObject({
      message: appMessage('CATEGORIES_UPDATE_EMPTY').message,
    });
  });

  it('should disable a category', async () => {
    categoriesRepository.findById.mockResolvedValue({
      id: 'cat-1',
      nom: 'Plomberie',
      urlIcone: null,
      ordreTri: 1,
      estActive: true,
    });
    categoriesRepository.disable.mockResolvedValue({
      status: 'disabled',
      category: {
        id: 'cat-1',
        nom: 'Plomberie',
        urlIcone: null,
        ordreTri: 1,
        estActive: false,
      },
    });

    const result = await service.disableCategory(
      {
        sub: 'admin-1',
        role: RoleUtilisateur.ADMIN,
        phoneNumber: '+221770000000',
      },
      'cat-1',
    );

    expect(result.estActive).toBe(false);
  });
});
