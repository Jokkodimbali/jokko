import { NegotiationEntity } from './negotiation.entity';
import { NegotiationDomainError } from '../errors/negotiation.domain-error';

describe('NegotiationEntity', () => {
  it('does not allow the client to counter while the professional has not answered yet', () => {
    const negotiation = NegotiationEntity.create({
      id: 'negotiation-id',
      clientId: 'client-id',
      professionnelId: 'professional-id',
      serviceId: 'service-id',
      montantInitial: 10000,
      offreId: 'offer-id',
    });

    expect(() =>
      negotiation.counterByClient({
        offerId: 'second-client-offer-id',
        amount: 9500,
      }),
    ).toThrow(NegotiationDomainError);
  });

  it('allows the client to counter after a professional counter-offer', () => {
    const negotiation = NegotiationEntity.create({
      id: 'negotiation-id',
      clientId: 'client-id',
      professionnelId: 'professional-id',
      serviceId: 'service-id',
      montantInitial: 10000,
      offreId: 'offer-id',
    });

    negotiation.counterByProfessional({
      offerId: 'professional-offer-id',
      amount: 12000,
    });
    negotiation.counterByClient({
      offerId: 'client-counter-offer-id',
      amount: 11000,
    });

    expect(negotiation.toView().statut).toBe('EN_ATTENTE_PRESTATAIRE');
    expect(negotiation.toView().montantCourant).toBe(11000);
  });
});
