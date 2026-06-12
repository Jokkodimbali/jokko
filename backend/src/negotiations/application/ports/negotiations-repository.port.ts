import type {
  Negotiation,
  NegotiationActor,
  NegotiationOffer,
  NegotiationStatus,
} from '../../domain';

export const NEGOTIATIONS_REPOSITORY_PORT = Symbol(
  'NEGOTIATIONS_REPOSITORY_PORT',
);

export type NegotiationListQuery = {
  userId: string;
  scope: 'CLIENT' | 'PRESTATAIRE';
  status?: NegotiationStatus;
  limit: number;
  offset: number;
};

export type NegotiationView = Negotiation & {
  client?: {
    id: string;
    nom: string;
    adresse: string | null;
    urlAvatar: string | null;
  };
  service?: {
    id: string;
    nom: string;
    prix: number;
  };
};
export type NegotiationOfferView = NegotiationOffer;

export type CreateNegotiationInput = {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  statut: NegotiationStatus;
  montantInitial: number;
  montantCourant: number;
  montantAccepte: number | null;
  dernierProposePar: NegotiationActor;
  messageCourant: string | null;
  dateHeureProposee: Date | null;
  adresseClientProposee: string | null;
  dureeMinutesProposee: number | null;
  raisonCloture: string | null;
  reservationId: string | null;
  creeLe: Date;
  misAJourLe: Date;
  initialOffer: {
    id: string;
    proposePar: NegotiationActor;
    montant: number;
    message: string | null;
    creeLe: Date;
  };
};

export type UpdateNegotiationInput = {
  id: string;
  statut: NegotiationStatus;
  montantCourant: number;
  montantAccepte: number | null;
  dernierProposePar: NegotiationActor;
  messageCourant: string | null;
  dateHeureProposee: Date | null;
  adresseClientProposee: string | null;
  dureeMinutesProposee: number | null;
  raisonCloture: string | null;
  reservationId: string | null;
  misAJourLe: Date;
  newOffer?: {
    id: string;
    proposePar: NegotiationActor;
    montant: number;
    message: string | null;
    creeLe: Date;
  };
};

export interface NegotiationsRepositoryPort {
  create(input: CreateNegotiationInput): Promise<NegotiationView>;
  createIfNoActive(
    input: CreateNegotiationInput,
  ): Promise<NegotiationView | null>;
  findById(negotiationId: string): Promise<NegotiationView | null>;
  listByActor(query: NegotiationListQuery): Promise<NegotiationView[]>;
  findActiveByClientAndService(
    clientId: string,
    serviceId: string,
  ): Promise<Pick<NegotiationView, 'id'> | null>;
  update(input: UpdateNegotiationInput): Promise<NegotiationView>;
}
