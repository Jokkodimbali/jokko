import { AdminServiceStructureService } from './admin-service-structure.service';

describe('AdminServiceStructureService', () => {
  const adminUser = {
    sub: 'admin-1',
    role: 'ADMIN',
    phoneNumber: '+221770000000',
  } as never;
  const clientUser = {
    sub: 'client-1',
    role: 'CLIENT',
    phoneNumber: '+221771111111',
  } as never;

  it('builds the service tree from real categories and declared services', async () => {
    const service = new AdminServiceStructureService(
      prismaMock([
        {
          id: 'cat-plomberie',
          nom: 'Plomberie & Sanitaires',
          urlIcone: null,
          ordreTri: 1,
          tauxCommission: decimal(10),
          estActive: true,
          sousCategories: [
            {
              ordreTri: 0,
              sousCategorie: {
                id: 'sub-reparation',
                nom: 'Reparation et depannage',
                description: 'Demandes urgentes',
                ordreTri: 0,
                estActive: true,
              },
            },
          ],
          services: [
            serviceRow('Reparation de fuite', true, false, 15000, 45),
            serviceRow('Reparation de fuite', true, true, 18000, 60),
            serviceRow('Installation lavabo', false, false, 25000, 90),
          ],
        },
      ]),
    );

    const report = await service.getStructure(adminUser);

    expect(report.totals).toMatchObject({
      categories: 1,
      activeCategories: 1,
      subCategories: 1,
      declaredServices: 3,
      availableServices: 2,
      requiredServices: 1,
    });
    expect(report.categories[0]).toMatchObject({
      id: 'cat-plomberie',
      name: 'Plomberie & Sanitaires',
      declaredServices: 3,
      availableServices: 2,
      requiredServices: 1,
      subCategories: [
        {
          id: 'sub-reparation',
          name: 'Reparation et depannage',
          description: 'Demandes urgentes',
        },
      ],
    });
    expect(report.availableSubCategories).toHaveLength(1);
    expect(report.categories[0].branches[1]).toMatchObject({
      label: 'Services disponibles',
      optionCount: 1,
    });
    expect(report.categories[0].branches[1].options[0]).toMatchObject({
      label: 'Reparation de fuite',
      offerCount: 2,
      minPrice: 15000,
      maxPrice: 18000,
      minDurationMinutes: 45,
      maxDurationMinutes: 60,
    });
  });

  it('rejects non-admin users', async () => {
    const service = new AdminServiceStructureService(prismaMock([]));

    await expect(service.getStructure(clientUser)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
      }),
    });
  });
});

function prismaMock(categories: unknown[]) {
  return {
    categorie: {
      findMany: jest.fn().mockResolvedValue(categories),
    },
    sousCategorieService: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sub-reparation',
          nom: 'Reparation et depannage',
          description: 'Demandes urgentes',
          ordreTri: 0,
          estActive: true,
        },
      ]),
    },
  } as never;
}

function serviceRow(
  name: string,
  available: boolean,
  required: boolean,
  price: number,
  duration: number,
) {
  return {
    id: `${name}-${available}-${required}`,
    nom: name,
    description: `${name} description`,
    prix: decimal(price),
    dureeMinutes: duration,
    estDisponible: available,
    estObligatoire: required,
  };
}

function decimal(value: number) {
  return {
    toString: () => String(value),
    valueOf: () => value,
  };
}
