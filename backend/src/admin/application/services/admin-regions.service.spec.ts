import { AdminRegionsService } from './admin-regions.service';

describe('AdminRegionsService', () => {
  const adminUser = { id: 'admin-1', role: 'ADMIN' } as never;
  const clientUser = { id: 'client-1', role: 'CLIENT' } as never;

  it('aggregates regional coverage from professional profiles and related data', async () => {
    const service = new AdminRegionsService(
      prismaMock([
        provider({
          id: 'provider-dakar',
          city: 'dakar',
          active: true,
          verified: true,
          services: [
            serviceRow('Sante', true),
            serviceRow('Maison', false),
          ],
          reservations: [
            reservationRow('TERMINEE', false),
            reservationRow('EN_COURS', true),
          ],
          payments: [paymentRow(20000, 18000)],
          rating: 4.5,
        }),
        provider({
          id: 'provider-missing-city',
          city: null,
          active: true,
          verified: true,
          services: [],
          reservations: [],
          payments: [],
          rating: 0,
        }),
      ]),
    );

    const report = await service.getRegions(adminUser);

    expect(report.totals).toMatchObject({
      clients: 3,
      regions: 14,
      providers: 2,
      activeProviders: 2,
      verifiedProviders: 2,
      services: 2,
      availableServices: 1,
      reservations: 2,
      completedReservations: 1,
      activeReservations: 1,
      disputes: 1,
      grossRevenue: 20000,
      netRevenue: 18000,
    });
    expect(report.regions[0].name).toBe('Dakar');
    expect(report.coverage.strongestRegion).toBe('Dakar');
    expect(report.regions[0]).toMatchObject({
      clients: 2,
      verificationRate: 100,
      completionRate: 50,
      averageRating: 4.5,
      topCategories: [
        { label: 'Sante', value: 1 },
        { label: 'Maison', value: 1 },
      ],
    });
  });

  it('rejects non-admin users', async () => {
    const service = new AdminRegionsService(prismaMock([]));

    await expect(service.getRegions(clientUser)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
      }),
    });
  });
});

function prismaMock(providers: unknown[]) {
  const clients = [
    { id: 'client-dakar-1', adresse: 'Dakar Plateau' },
    { id: 'client-dakar-2', adresse: 'Yoff Dakar' },
    { id: 'client-thies-1', adresse: 'Mbour' },
  ];

  return {
    profilProfessionnel: {
      findMany: jest.fn().mockResolvedValue(providers),
    },
    utilisateur: {
      findMany: jest.fn().mockResolvedValue(clients),
    },
    $transaction: jest.fn().mockResolvedValue([providers, clients]),
  } as never;
}

function provider(input: {
  id: string;
  city: string | null;
  active: boolean;
  verified: boolean;
  services: unknown[];
  reservations: unknown[];
  payments: unknown[];
  rating: number;
}) {
  return {
    id: input.id,
    ville: input.city,
    statutKyc: input.verified ? 'VERIFIE' : 'EN_ATTENTE',
    noteGlobale: decimal(input.rating),
    utilisateur: { estActif: input.active },
    services: input.services,
    reservations: input.reservations,
    paiements: input.payments,
  };
}

function serviceRow(category: string, available: boolean) {
  return {
    id: `${category}-${available}`,
    estDisponible: available,
    categorie: { nom: category },
  };
}

function reservationRow(status: string, hasDispute: boolean) {
  return {
    id: `${status}-${hasDispute}`,
    statut: status,
    litige: hasDispute ? { id: 'dispute-1' } : null,
  };
}

function paymentRow(amount: number, net: number) {
  return {
    statut: 'SUCCES',
    montant: decimal(amount),
    montantNet: decimal(net),
  };
}

function decimal(value: number) {
  return {
    toNumber: () => value,
  };
}
