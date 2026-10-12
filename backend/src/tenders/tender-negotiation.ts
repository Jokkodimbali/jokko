import { randomUUID } from 'node:crypto';
import { type Prisma, type Tender, type TenderResponse } from '@prisma/client';
import { NegotiationEntity } from '../negotiations/domain/entities/negotiation.entity';

/** Bridges a chosen tender to the existing negotiation/reservation/payment workflow. */
export function acceptedTenderNegotiation(
  tender: Tender,
  response: TenderResponse,
): Prisma.NegotiationUncheckedCreateInput {
  const entity = NegotiationEntity.create({
    id: randomUUID(),
    clientId: tender.clientId,
    professionnelId: response.professionalId,
    serviceId: response.serviceId!,
    montantInitial: Number(tender.proposedPrice),
    messageCourant: tender.description,
    offreId: randomUUID(),
    dateHeureProposee: tender.scheduledAt,
    adresseClientProposee: tender.address,
  });
  entity.counterByProfessional({
    offerId: randomUUID(),
    amount: Number(response.amount),
    message: response.message,
  });
  entity.acceptByClient();
  const { propositions, ...state } = entity.toView();
  return {
    ...state,
    propositions: {
      create: propositions.map(({ negotiationId, ...offer }) => {
        void negotiationId; // The nested create supplies the parent relation.
        return offer;
      }),
    },
  };
}
