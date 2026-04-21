import {
  type PaymentMethod,
  PaymentStatus,
  EscrowStatus,
} from '../value-objects/payment-types.vo';
import { PaymentAmount } from '../value-objects/payment-amount.vo';
import { TransactionReference } from '../value-objects/transaction-reference.vo';
import { PaymentDomainError } from '../errors/payment.domain-error';
import { type DomainEvent } from '../../../shared/domain/events/domain-event.base';
import {
  PaymentInitiatedEvent,
  PaymentSucceededEvent,
  EscrowReleasedEvent,
  EscrowDisputedEvent,
  EscrowRefundedEvent,
} from '../events/payment.events';

export class Payment {
  private readonly _id: string;
  private readonly _bookingId: string;
  private readonly _clientId: string;
  private readonly _professionalId: string;
  private readonly _method: PaymentMethod;
  private _status: PaymentStatus;
  private _escrowStatus: EscrowStatus;
  private readonly _amount: PaymentAmount;
  private readonly _commissionAmount: PaymentAmount;
  private readonly _netAmount: PaymentAmount;
  private _transactionReference: TransactionReference | null;
  private _gatewayReference: string | null;
  private _processedAt: Date | null;
  private _escrowReleasedAt: Date | null;
  private _disputedAt: Date | null;
  private _refundReason: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  private constructor(params: {
    id: string;
    bookingId: string;
    clientId: string;
    professionalId: string;
    method: PaymentMethod;
    amount: PaymentAmount;
    commissionAmount: PaymentAmount;
    netAmount: PaymentAmount;
  }) {
    this._id = params.id;
    this._bookingId = params.bookingId;
    this._clientId = params.clientId;
    this._professionalId = params.professionalId;
    this._method = params.method;
    this._status = PaymentStatus.PENDING;
    this._escrowStatus = EscrowStatus.LOCKED;
    this._amount = params.amount;
    this._commissionAmount = params.commissionAmount;
    this._netAmount = params.netAmount;
    this._transactionReference = null;
    this._gatewayReference = null;
    this._processedAt = null;
    this._escrowReleasedAt = null;
    this._disputedAt = null;
    this._refundReason = null;
    this._createdAt = new Date();
    this._updatedAt = new Date();
    this._domainEvents = [];
  }

  static create(params: {
    id: string;
    bookingId: string;
    clientId: string;
    professionalId: string;
    method: PaymentMethod;
    amount: PaymentAmount;
    commissionRate?: number; // Pourcentage (ex: 10 pour 10%)
  }): Payment {
    const commissionRate = params.commissionRate || 10; // 10% par défaut
    const commissionAmount = params.amount.percentage(commissionRate);
    const netAmount = params.amount.subtract(commissionAmount);

    const payment = new Payment({
      id: params.id,
      bookingId: params.bookingId,
      clientId: params.clientId,
      professionalId: params.professionalId,
      method: params.method,
      amount: params.amount,
      commissionAmount,
      netAmount,
    });

    payment._domainEvents.push(
      new PaymentInitiatedEvent(
        payment.id,
        params.bookingId,
        params.clientId,
        params.professionalId,
        params.amount.getValue(),
        params.method,
      ),
    );

    return payment;
  }

  static reconstitute(params: {
    id: string;
    bookingId: string;
    clientId: string;
    professionalId: string;
    method: PaymentMethod;
    status: PaymentStatus;
    escrowStatus: EscrowStatus;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    transactionReference: string | null;
    gatewayReference: string | null;
    processedAt: Date | null;
    escrowReleasedAt: Date | null;
    disputedAt: Date | null;
    refundReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Payment {
    const payment = new Payment({
      id: params.id,
      bookingId: params.bookingId,
      clientId: params.clientId,
      professionalId: params.professionalId,
      method: params.method,
      amount: PaymentAmount.create(params.amount),
      commissionAmount: PaymentAmount.create(params.commissionAmount),
      netAmount: PaymentAmount.create(params.netAmount),
    });

    payment._status = params.status;
    payment._escrowStatus = params.escrowStatus;
    payment._transactionReference = params.transactionReference
      ? TransactionReference.create(params.transactionReference)
      : null;
    payment._gatewayReference = params.gatewayReference;
    payment._processedAt = params.processedAt;
    payment._escrowReleasedAt = params.escrowReleasedAt;
    payment._disputedAt = params.disputedAt;
    payment._refundReason = params.refundReason;
    payment._createdAt = params.createdAt;
    payment._updatedAt = params.updatedAt;

    return payment;
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get bookingId(): string {
    return this._bookingId;
  }
  get clientId(): string {
    return this._clientId;
  }
  get professionalId(): string {
    return this._professionalId;
  }
  get method(): PaymentMethod {
    return this._method;
  }
  get status(): PaymentStatus {
    return this._status;
  }
  get escrowStatus(): EscrowStatus {
    return this._escrowStatus;
  }
  get amount(): PaymentAmount {
    return this._amount;
  }
  get commissionAmount(): PaymentAmount {
    return this._commissionAmount;
  }
  get netAmount(): PaymentAmount {
    return this._netAmount;
  }
  get transactionReference(): TransactionReference | null {
    return this._transactionReference;
  }
  get gatewayReference(): string | null {
    return this._gatewayReference;
  }
  get processedAt(): Date | null {
    return this._processedAt;
  }
  get escrowReleasedAt(): Date | null {
    return this._escrowReleasedAt;
  }
  get disputedAt(): Date | null {
    return this._disputedAt;
  }
  get refundReason(): string | null {
    return this._refundReason;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business logic
  markAsProcessing(transactionReference?: TransactionReference): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw PaymentDomainError.alreadyProcessed();
    }

    this._status = PaymentStatus.PROCESSING;
    if (transactionReference) {
      this._transactionReference = transactionReference;
    }
    this.touch();
  }

  markAsSuccess(gatewayReference: string): void {
    if (this._status === PaymentStatus.SUCCESS) {
      return;
    }

    this._status = PaymentStatus.SUCCESS;
    this._gatewayReference = gatewayReference;
    this._processedAt = new Date();
    this.touch();

    this._domainEvents.push(
      new PaymentSucceededEvent(
        this._id,
        this._bookingId,
        this._amount.getValue(),
        gatewayReference,
      ),
    );
  }

  markAsFailed(reason?: string): void {
    this._status = PaymentStatus.FAILED;
    if (reason) {
      this._refundReason = reason;
    }
    this.touch();
  }

  markAsCancelled(): void {
    if (this._status === PaymentStatus.SUCCESS) {
      throw PaymentDomainError.alreadyProcessed();
    }

    this._status = PaymentStatus.CANCELLED;
    this.touch();
  }

  releaseEscrow(): void {
    if (this._escrowStatus !== EscrowStatus.LOCKED) {
      throw PaymentDomainError.escrowAlreadyReleased();
    }

    this._escrowStatus = EscrowStatus.RELEASED;
    this._escrowReleasedAt = new Date();
    this.touch();

    this._domainEvents.push(new EscrowReleasedEvent(this._id, this._bookingId));
  }

  disputeEscrow(reason?: string): void {
    if (this._escrowStatus !== EscrowStatus.LOCKED) {
      throw PaymentDomainError.escrowAlreadyDisputed();
    }

    this._escrowStatus = EscrowStatus.DISPUTED;
    this._disputedAt = new Date();
    this.touch();

    this._domainEvents.push(
      new EscrowDisputedEvent(this._id, this._bookingId, reason),
    );
  }

  refund(reason?: string): void {
    if (this._escrowStatus === EscrowStatus.RELEASED) {
      throw PaymentDomainError.escrowAlreadyReleased();
    }

    this._escrowStatus = EscrowStatus.REFUNDED;
    this._status = PaymentStatus.REFUNDED;
    this._refundReason = reason || null;
    this.touch();

    this._domainEvents.push(
      new EscrowRefundedEvent(this._id, this._bookingId, reason),
    );
  }

  // Status checks
  isPending(): boolean {
    return this._status === PaymentStatus.PENDING;
  }

  isProcessing(): boolean {
    return this._status === PaymentStatus.PROCESSING;
  }

  isSuccessful(): boolean {
    return this._status === PaymentStatus.SUCCESS;
  }

  isFailed(): boolean {
    return this._status === PaymentStatus.FAILED;
  }

  isEscrowLocked(): boolean {
    return this._escrowStatus === EscrowStatus.LOCKED;
  }

  isEscrowReleased(): boolean {
    return this._escrowStatus === EscrowStatus.RELEASED;
  }

  isEscrowDisputed(): boolean {
    return this._escrowStatus === EscrowStatus.DISPUTED;
  }

  canBeRefunded(): boolean {
    return (
      this._status === PaymentStatus.SUCCESS &&
      (this._escrowStatus === EscrowStatus.LOCKED ||
        this._escrowStatus === EscrowStatus.DISPUTED) &&
      this._refundReason === null
    );
  }

  canReleaseEscrow(): boolean {
    return (
      this._status === PaymentStatus.SUCCESS &&
      this._escrowStatus === EscrowStatus.LOCKED
    );
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  toView() {
    return {
      id: this._id,
      bookingId: this._bookingId,
      clientId: this._clientId,
      professionalId: this._professionalId,
      method: this._method,
      status: this._status,
      escrowStatus: this._escrowStatus,
      amount: this._amount.getValue(),
      commissionAmount: this._commissionAmount.getValue(),
      netAmount: this._netAmount.getValue(),
      transactionReference: this._transactionReference?.getValue() || null,
      gatewayReference: this._gatewayReference,
      processedAt: this._processedAt,
      escrowReleasedAt: this._escrowReleasedAt,
      disputedAt: this._disputedAt,
      refundReason: this._refundReason,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
