import { RoleUtilisateur } from '@prisma/client';
import { AuthRepository } from './auth.repository';

describe('AuthRepository professional specialties', () => {
  const createRepository = () => {
    const tx = {
      utilisateur: {
        create: jest.fn().mockResolvedValue({ id: 'user-id' }),
      },
      profilProfessionnel: {
        create: jest.fn().mockResolvedValue({ id: 'profile-id' }),
      },
      categorie: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'category-id',
            nom: 'Sante',
            sousCategories: [
              {
                sousCategorieId: 'subcategory-id',
                sousCategorie: { id: 'subcategory-id' },
              },
            ],
          },
        ]),
      },
      sousCategorieService: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'subcategory-id', nom: 'Cardiologie' }]),
      },
      specialiteProfessionnelle: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      service: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    return {
      repository: new AuthRepository(prisma as never),
      tx,
    };
  };

  it('creates negotiable generated services for providers', async () => {
    const { repository, tx } = createRepository();

    await repository.createClientWithPassword({
      phoneNumber: '+221771234567',
      name: 'Prestataire Test',
      email: 'prestataire@test.sn',
      passwordHash: 'hash',
      role: RoleUtilisateur.PRESTATAIRE,
      adresse: 'Dakar',
      categoryIds: ['category-id'],
      subCategoryIds: ['subcategory-id'],
    });

    expect(tx.service.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          categorieId: 'category-id',
          nom: 'Sante',
          typePrix: 'NEGOCIABLE',
        }),
      ],
    });
  });

  it('creates fixed-price generated services for doctors', async () => {
    const { repository, tx } = createRepository();

    await repository.createClientWithPassword({
      phoneNumber: '+221771234568',
      name: 'Medecin Test',
      email: 'medecin@test.sn',
      passwordHash: 'hash',
      role: RoleUtilisateur.MEDECIN,
      adresse: 'Dakar',
      categoryIds: ['category-id'],
      subCategoryIds: ['subcategory-id'],
    });

    expect(tx.service.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          categorieId: 'category-id',
          nom: 'Sante',
          typePrix: 'FIXE',
        }),
      ],
    });
  });
});
