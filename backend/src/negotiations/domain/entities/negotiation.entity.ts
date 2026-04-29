import { NegotiationDomainError } from '../errors/negotiation.domain-error';
import type { NegotiationDomainEvent } from '../events/negotiation.events';

export type NegotiationStatus =
  | 'EN_ATTENTE_PRESTATAIRE'
  | 'EN_ATTENTE_CLIENT'
  | 'ACCEPTEE'
  | 'REFUSEE'
  | 'ANNULEE'
  | 'CONVERTIE_EN_RESERVATION';

export type NegotiationActor = 'CLIENT' | 'PRESTATAIRE';

export type NegotiationOffer = {
  id: string;
  negotiationId: string;
  proposePar: NegotiationActor;
  montant: number;
  message: string | null;
  creeLe: Date;
};

export type Negotiation = {
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
  raisonCloture: string | null;
  reservationId: string | null;
  creeLe: Date;
  misAJourLe: Date;
  propositions: NegotiationOffer[];
};

export class NegotiationEntity {
  private pendingOffer: NegotiationOffer | null = null;

  private constructor(
    private readonly state: Negotiation,
    private readonly domainEvents: NegotiationDomainEvent[] = [],
  ) {}

  get id(): string {
    return this.state.id;
  }

  get clientId(): string {
    return this.state.clientId;
  }

  get professionnelId(): string {
    return this.state.professionnelId;
  }

  get serviceId(): string {
    return this.state.serviceId;
  }

  get statut(): NegotiationStatus {
    return this.state.statut;
  }

  get montantCourant(): number {
    return this.state.montantCourant;
  }

  get montantAccepte(): number | null {
    return this.state.montantAccepte;
  }

  get dernierProposePar(): NegotiationActor {
    return this.state.dernierProposePar;
  }

  static create(input: {
    id: string;
    clientId: string;
    professionnelId: string;
    serviceId: string;
    montantInitial: number;
    messageCourant?: string | null;
    offreId: string;
  }): NegotiationEntity {
    this.assertPositiveAmount(input.montantInitial);
    const now = new Date();
    const entity = new NegotiationEntity({
      id: input.id,
      clientId: input.clientId,
      professionnelId: input.professionnelId,
      serviceId: input.serviceId,
      statut: 'EN_ATTENTE_PRESTATAIRE',
      montantInitial: input.montantInitial,
      montantCourant: input.montantInitial,
      montantAccepte: null,
      dernierProposePar: 'CLIENT',
      messageCourant: this.normalizeText(input.messageCourant),
      raisonCloture: null,
      reservationId: null,
      creeLe: now,
      misAJourLe: now,
      propositions: [
        {
          id: input.offreId,
          negotiationId: input.id,
          proposePar: 'CLIENT',
          montant: input.montantInitial,
          message: this.normalizeText(input.messageCourant),
          creeLe: now,
        },
      ],
    });

    entity.domainEvents.push({
      name: 'negotiations.created',
      negotiationId: entity.id,
      clientId: entity.clientId,
      professionalId: entity.professionnelId,
      serviceId: entity.serviceId,
      amount: entity.montantCourant,
    });

    return entity;
  }

  static reconstitute(state: Negotiation): NegotiationEntity {
    return new NegotiationEntity({
      ...state,
      propositions: state.propositions.map((offer) => ({
        ...offer,
        creeLe: new Date(offer.creeLe),
      })),
      creeLe: new Date(state.creeLe),
      misAJourLe: new Date(state.misAJourLe),
    });
  }

  counterByClient(input: {
    offerId: string;
    amount: number;
    message?: string | null;
  }): void {
    this.assertPendingStatus('EN_ATTENTE_CLIENT');
    this.applyCounterOffer('CLIENT', input);
  }

  counterByProfessional(input: {
    offerId: string;
    amount: number;
    message?: string | null;
  }): void {
    this.assertPendingStatus('EN_ATTENTE_PRESTATAIRE');
    this.applyCounterOffer('PRESTATAIRE', input);
  }

  acceptByClient(): void {
    this.assertPendingStatus('EN_ATTENTE_CLIENT');
    this.state.statut = 'ACCEPTEE';
    this.state.montantAccepte = this.state.montantCourant;
    this.touch();
    this.domainEvents.push({
      name: 'negotiations.accepted',
      negotiationId: this.id,
      clientId: this.clientId,
      professionalId: this.professionnelId,
      amount: this.state.montantCourant,
    });
  }

  acceptByProfessional(): void {
    this.assertPendingStatus('EN_ATTENTE_PRESTATAIRE');
    this.state.statut = 'ACCEPTEE';
    this.state.montantAccepte = this.state.montantCourant;
    this.touch();
    this.domainEvents.push({
      name: 'negotiations.accepted',
      negotiationId: this.id,
      clientId: this.clientId,
      professionalId: this.professionnelId,
      amount: this.state.montantCourant,
    });
  }

  rejectByProfessional(reason?: string | null): void {
    this.assertPendingStatus('EN_ATTENTE_PRESTATAIRE');
    this.close('REFUSEE', reason);
    this.domainEvents.push({
      name: 'negotiations.rejected',
      negotiationId: this.id,
      clientId: this.clientId,
      professionalId: this.professionnelId,
      reason: this.state.raisonCloture,
    });
  }

  cancelByClient(reason?: string | null): void {
    if (this.state.statut === 'CONVERTIE_EN_RESERVATION') {
      throw NegotiationDomainError.alreadyConverted();
    }

    if (this.state.statut === 'ACCEPTEE') {
      this.state.statut = 'ANNULEE';
      this.state.raisonCloture = NegotiationEntity.normalizeText(reason);
      this.touch();
    } else {
      this.assertOpen();
      this.close('ANNULEE', reason);
    }

    this.domainEvents.push({
      name: 'negotiations.cancelled',
      negotiationId: this.id,
      clientId: this.clientId,
      professionalId: this.professionnelId,
      reason: this.state.raisonCloture,
    });
  }

  getDomainEvents(): readonly NegotiationDomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  getPendingOffer(): NegotiationOffer | null {
    return this.pendingOffer ? { ...this.pendingOffer } : null;
  }

  clearPendingOffer(): void {
    this.pendingOffer = null;
  }

  toView(): Negotiation {
    return {
      ...this.state,
      creeLe: new Date(this.state.creeLe),
      misAJourLe: new Date(this.state.misAJourLe),
      propositions: this.state.propositions.map((offer) => ({
        ...offer,
        creeLe: new Date(offer.creeLe),
      })),
    };
  }

  private applyCounterOffer(
    actor: NegotiationActor,
    input: { offerId: string; amount: number; message?: string | null },
  ): void {
    NegotiationEntity.assertPositiveAmount(input.amount);

    const message = NegotiationEntity.normalizeText(input.message);
    const offer: NegotiationOffer = {
      id: input.offerId,
      negotiationId: this.id,
      proposePar: actor,
      montant: input.amount,
      message,
      creeLe: new Date(),
    };

    this.state.propositions.push(offer);
    this.pendingOffer = offer;
    this.state.montantCourant = input.amount;
    this.state.dernierProposePar = actor;
    this.state.messageCourant = message;
    this.state.statut =
      actor === 'CLIENT' ? 'EN_ATTENTE_PRESTATAIRE' : 'EN_ATTENTE_CLIENT';
    this.state.montantAccepte = null;
    this.touch();

    this.domainEvents.push({
      name: 'negotiations.countered',
      negotiationId: this.id,
      clientId: this.clientId,
      professionalId: this.professionnelId,
      actor,
      amount: input.amount,
    });
  }

  private close(status: 'REFUSEE' | 'ANNULEE', reason?: string | null): void {
    this.assertOpen();
    this.state.statut = status;
    this.state.raisonCloture = NegotiationEntity.normalizeText(reason);
    this.touch();
  }

  private assertPendingStatus(expected: NegotiationStatus): void {
    if (this.state.statut === 'CONVERTIE_EN_RESERVATION') {
      throw NegotiationDomainError.alreadyConverted();
    }

    if (this.state.statut !== expected) {
      if (
        this.state.statut === 'ACCEPTEE' ||
        this.state.statut === 'REFUSEE' ||
        this.state.statut === 'ANNULEE'
      ) {
        throw NegotiationDomainError.alreadyClosed();
      }

      throw NegotiationDomainError.wrongTurn();
    }
  }

  private assertOpen(): void {
    if (
      this.state.statut === 'REFUSEE' ||
      this.state.statut === 'ANNULEE' ||
      this.state.statut === 'ACCEPTEE' ||
      this.state.statut === 'CONVERTIE_EN_RESERVATION'
    ) {
      throw NegotiationDomainError.alreadyClosed();
    }
  }

  private touch(): void {
    this.state.misAJourLe = new Date();
  }

  private static assertPositiveAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw NegotiationDomainError.amountInvalid();
    }
  }

  private static normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
