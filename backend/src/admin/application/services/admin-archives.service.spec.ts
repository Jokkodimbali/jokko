import { AdminArchivesService } from './admin-archives.service';

describe('AdminArchivesService', () => {
  const adminUser = { id: 'admin-1', role: 'ADMIN' } as never;
  const clientUser = { id: 'client-1', role: 'CLIENT' } as never;

  it('builds archive totals from closed disputes, invoices and wallet transactions', async () => {
    const service = new AdminArchivesService(
      prismaMock({
        disputes: [closedDispute()],
        invoices: [invoice(45000, 4500), invoice(120000, 12000)],
        transactions: [
          walletTransaction('CREDIT_ESCROW', 40000),
          walletTransaction('COMMISSION', 4000),
        ],
      }),
    );

    const report = await service.getArchives(adminUser, {
      tab: 'transactions',
    });

    expect(report.totals).toMatchObject({
      closedDisputes: 1,
      invoices: 2,
      transactions: 2,
      invoiceGrossAmount: 165000,
      invoiceCommissionAmount: 16500,
      transactionAmount: 44000,
    });
    const disputesReport = await service.getArchives(adminUser, {
      tab: 'closedDisputes',
    });
    expect(disputesReport.closedDisputes[0]).toMatchObject({
      reference: 'LT-DISPUTE1',
      from: 'Awa Ndiaye',
      to: 'Plomberie Touba SARL',
      amount: 45000,
      commission: 4500,
      status: 'RESOLU',
    });
    expect(report.transactions[1]).toMatchObject({
      type: 'COMMISSION',
      amount: -4000,
      commission: 4000,
    });
  });

  it('rejects non-admin users', async () => {
    const service = new AdminArchivesService(
      prismaMock({ disputes: [], invoices: [], transactions: [] }),
    );

    await expect(service.getArchives(clientUser)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
      }),
    });
  });
});

function prismaMock(input: {
  disputes: unknown[];
  invoices: unknown[];
  transactions: unknown[];
}) {
  return {
    litige: {
      count: jest.fn().mockResolvedValue(input.disputes.length),
      findMany: jest.fn().mockResolvedValue(input.disputes),
    },
    paiement: {
      count: jest.fn().mockResolvedValue(input.invoices.length),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          montant: decimal(
            input.invoices.reduce(
              (total, row) =>
                total +
                Number(
                  (
                    row as { montant: { toNumber(): number } }
                  ).montant.toNumber(),
                ),
              0,
            ),
          ),
          montantCommission: decimal(
            input.invoices.reduce(
              (total, row) =>
                total +
                Number(
                  (
                    row as { montantCommission: { toNumber(): number } }
                  ).montantCommission.toNumber(),
                ),
              0,
            ),
          ),
        },
      }),
      findMany: jest.fn().mockResolvedValue(input.invoices),
    },
    transactionPortefeuille: {
      count: jest.fn().mockResolvedValue(input.transactions.length),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          montant: decimal(
            input.transactions.reduce(
              (total, row) =>
                total +
                Number(
                  (
                    row as { montant: { toNumber(): number } }
                  ).montant.toNumber(),
                ),
              0,
            ),
          ),
        },
      }),
      findMany: jest.fn().mockResolvedValue(input.transactions),
    },
    $transaction: jest
      .fn()
      .mockResolvedValue([input.disputes, input.invoices, input.transactions]),
  } as never;
}

function closedDispute() {
  return {
    id: 'dispute-123456',
    statut: 'RESOLU',
    priorite: 'HAUTE',
    raison: 'Fuite revenue apres intervention',
    decisionResolution: 'REMBOURSER_CLIENT',
    montantRembourseClient: decimal(45000),
    montantPrestataire: decimal(0),
    ouvertLe: new Date('2026-05-09T10:00:00.000Z'),
    resoluLe: new Date('2026-05-10T10:00:00.000Z'),
    rejeteLe: null,
    reservation: {
      id: 'booking-1',
      dateHeure: new Date('2026-05-09T14:32:00.000Z'),
      prixConvenu: decimal(45000),
      service: { nom: 'Reparation fuite de cuisine' },
      client: { nom: 'Awa Ndiaye' },
      professionnel: professional(),
    },
    paiement: {
      id: 'payment-1',
      montant: decimal(45000),
      montantCommission: decimal(4500),
      montantNet: decimal(40500),
      methode: 'WAVE',
      statut: 'REMBOURSE',
      referenceTransaction: 'TX-9821',
    },
  };
}

function invoice(amount: number, commission: number) {
  return {
    id: `invoice-${amount}`,
    montant: decimal(amount),
    montantCommission: decimal(commission),
    montantNet: decimal(amount - commission),
    methode: 'WAVE',
    statut: 'SUCCES',
    referenceTransaction: `FA-${amount}`,
    referenceFournisseur: null,
    gatewayReference: null,
    processedAt: new Date('2026-05-06T10:00:00.000Z'),
    creeLe: new Date('2026-05-06T09:58:00.000Z'),
    client: { nom: 'Moussa Fall' },
    professionnel: professional(),
    reservation: {
      id: `booking-${amount}`,
      dateHeure: new Date('2026-05-06T09:00:00.000Z'),
      service: { nom: 'Diagnostic plomberie' },
    },
  };
}

function walletTransaction(type: string, amount: number) {
  return {
    id: `wallet-${type}`,
    type,
    montant: decimal(amount),
    soldeApres: decimal(100000),
    description: type,
    reference: `WT-${type}`,
    creeLe: new Date('2026-05-07T10:00:00.000Z'),
    profilProfessionnel: professional(),
    paiement: {
      id: 'payment-wallet',
      methode: 'WAVE',
      statut: 'SUCCES',
      client: { nom: 'Client Jokko' },
      reservation: {
        service: { nom: 'Intervention plomberie' },
      },
    },
  };
}

function professional() {
  return {
    nomEntreprise: 'Plomberie Touba SARL',
    utilisateur: { nom: 'Nicolas Diop' },
  };
}

function decimal(value: number) {
  return { toNumber: () => value };
}
