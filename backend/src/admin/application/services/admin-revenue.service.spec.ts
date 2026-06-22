import { RoleUtilisateur, type StatutPaiement } from '@prisma/client';
import { AdminRevenueService } from './admin-revenue.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';

describe('AdminRevenueService', () => {
  const adminUser: AuthUser = {
    sub: 'admin-id',
    userId: 'admin-id',
    role: RoleUtilisateur.ADMIN,
    phoneNumber: '+221771234567',
  };

  it('builds real revenue aggregates from payment rows without static values', async () => {
    const prisma = mockPrisma([
      payment({
        id: 'payment-1',
        amount: 20_000,
        net: 18_000,
        commission: 2_000,
        method: 'WAVE',
        status: 'SUCCES',
        providerId: 'provider-1',
        providerName: 'Plomberie Touba SARL',
      }),
      payment({
        id: 'payment-2',
        amount: 10_000,
        net: 9_000,
        commission: 1_000,
        method: 'CARTE',
        status: 'SUCCES',
        providerId: 'provider-1',
        providerName: 'Plomberie Touba SARL',
      }),
      payment({
        id: 'payment-3',
        amount: 5_000,
        net: 0,
        commission: 0,
        method: 'ORANGE_MONEY',
        status: 'REMBOURSE',
        providerId: 'provider-2',
        providerName: 'Garage Mecano Plus',
      }),
      payment({
        id: 'payment-4',
        amount: 7_000,
        net: 0,
        commission: 0,
        method: 'WAVE',
        status: 'ECHEC',
        providerId: 'provider-3',
        providerName: 'Awa Couture',
      }),
    ]);
    const service = new AdminRevenueService(prisma);

    const report = await service.getRevenue(adminUser, '30d');

    expect(report.totals).toMatchObject({
      gross: 30_000,
      net: 27_000,
      commission: 3_000,
      refunded: 5_000,
      totalPayments: 4,
      successfulPayments: 2,
      refundedPayments: 1,
      failedPayments: 1,
      averageTicket: 15_000,
      successRate: 50,
    });
    expect(report.methods).toEqual([
      { key: 'WAVE', label: 'Wave', gross: 20_000, transactions: 1, share: 67 },
      {
        key: 'ORANGE_MONEY',
        label: 'Orange Money',
        gross: 0,
        transactions: 0,
        share: 0,
      },
      {
        key: 'CARTE',
        label: 'Carte bancaire',
        gross: 10_000,
        transactions: 1,
        share: 33,
      },
    ]);
    expect(report.topProviders[0]).toMatchObject({
      id: 'provider-1',
      name: 'Plomberie Touba SARL',
      gross: 30_000,
      net: 27_000,
      transactions: 2,
    });
    expect(report.recentPayments).toHaveLength(4);
    expect(report.series).toHaveLength(30);
    expect(report.series.some((point) => point.gross === 30_000)).toBe(true);
  });

  it('rejects non-admin users', async () => {
    const service = new AdminRevenueService(mockPrisma([]));

    await expect(
      service.getRevenue({ ...adminUser, role: RoleUtilisateur.CLIENT }, '12m'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
      }),
    });
  });
});

function mockPrisma(payments: unknown[]): PrismaService {
  return {
    paiement: {
      findMany: jest.fn().mockResolvedValue(payments),
    },
  } as unknown as PrismaService;
}

function payment(input: {
  id: string;
  amount: number;
  net: number;
  commission: number;
  method: 'WAVE' | 'ORANGE_MONEY' | 'CARTE';
  status: keyof typeof StatutPaiement;
  providerId: string;
  providerName: string;
}) {
  return {
    id: input.id,
    montant: input.amount,
    montantNet: input.net,
    montantCommission: input.commission,
    methode: input.method,
    statut: input.status,
    referenceTransaction: `JOKKO_TEST_${input.id}`,
    referenceFournisseur: null,
    gatewayReference: null,
    creeLe: new Date(),
    client: { nom: 'Client Jokko' },
    professionnel: {
      id: input.providerId,
      nomEntreprise: input.providerName,
      ville: 'Dakar',
      utilisateur: { nom: input.providerName },
    },
    reservation: {
      service: { nom: 'Service de verification' },
    },
  };
}
