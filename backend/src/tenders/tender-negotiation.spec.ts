import { Prisma, type Tender, type TenderResponse } from '@prisma/client';
import { acceptedTenderNegotiation } from './tender-negotiation';

it.each([10000, 12000])(
  'preserves the agreed price %s and booking details in the existing negotiation workflow',
  (amount) => {
    const tender = {
      id: 'tender',
      clientId: 'client',
      proposedPrice: new Prisma.Decimal(10000),
      scheduledAt: new Date('2030-01-01T10:00:00Z'),
      address: 'Dakar',
      description: 'Réparer la fuite',
    } as Tender;
    const response = {
      professionalId: 'professional',
      serviceId: 'service',
      amount: new Prisma.Decimal(amount),
      message: 'Disponible',
    } as TenderResponse;
    const result = acceptedTenderNegotiation(tender, response);
    expect(result).toMatchObject({
      clientId: 'client',
      professionnelId: 'professional',
      serviceId: 'service',
      statut: 'ACCEPTEE',
      montantInitial: 10000,
      montantAccepte: amount,
      montantCourant: amount,
      adresseClientProposee: 'Dakar',
      dateHeureProposee: tender.scheduledAt,
    });
    expect(result.reservationId).toBeNull();
  },
);
