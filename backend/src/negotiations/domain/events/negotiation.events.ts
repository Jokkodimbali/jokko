export type NegotiationDomainEvent =
  | {
      name: 'negotiations.created';
      negotiationId: string;
      clientId: string;
      professionalId: string;
      serviceId: string;
      amount: number;
    }
  | {
      name: 'negotiations.countered';
      negotiationId: string;
      clientId: string;
      professionalId: string;
      actor: 'CLIENT' | 'PRESTATAIRE';
      amount: number;
    }
  | {
      name: 'negotiations.accepted';
      negotiationId: string;
      clientId: string;
      professionalId: string;
      amount: number;
    }
  | {
      name: 'negotiations.rejected';
      negotiationId: string;
      clientId: string;
      professionalId: string;
      reason: string | null;
    }
  | {
      name: 'negotiations.cancelled';
      negotiationId: string;
      clientId: string;
      professionalId: string;
      reason: string | null;
    }
  | {
      name: 'negotiations.converted';
      negotiationId: string;
      reservationId: string;
      clientId: string;
      professionalId: string;
      amount: number;
    };
