import { ReservationDomainError } from '../errors/reservation.domain-error';

export type ReservationStatus =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'ANNULEE'
  | 'TERMINEE'
  | 'NO_SHOW';

export type Reservation = {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: Date;
  dureeMinutes: number;
  statut: ReservationStatus;
  notes: string | null;
  raisonAnnulation: string | null;
  creeLe: Date;
  misAJourLe: Date;
};

export class ReservationEntity {
  private constructor(
    private readonly _id: string,
    private readonly _clientId: string,
    private readonly _professionnelId: string,
    private readonly _serviceId: string,
    private _dateHeure: Date,
    private _dureeMinutes: number,
    private _statut: ReservationStatus,
    private _notes: string | null,
    private _raisonAnnulation: string | null,
    private readonly _creeLe: Date,
    private readonly _misAJourLe: Date,
    private domainEvents: ReservationDomainEvent[] = [],
  ) {}

  get id(): string {
    return this._id;
  }

  get clientId(): string {
    return this._clientId;
  }

  get professionnelId(): string {
    return this._professionnelId;
  }

  get serviceId(): string {
    return this._serviceId;
  }

  get dateHeure(): Date {
    return this._dateHeure;
  }

  get dureeMinutes(): number {
    return this._dureeMinutes;
  }

  get statut(): ReservationStatus {
    return this._statut;
  }

  get notes(): string | null {
    return this._notes;
  }

  get raisonAnnulation(): string | null {
    return this._raisonAnnulation;
  }

  get creeLe(): Date {
    return this._creeLe;
  }

  get misAJourLe(): Date {
    return this._misAJourLe;
  }

  get isPending(): boolean {
    return this._statut === 'EN_ATTENTE';
  }

  get isConfirmed(): boolean {
    return this._statut === 'CONFIRMEE';
  }

  get isCancelled(): boolean {
    return this._statut === 'ANNULEE';
  }

  get isCompleted(): boolean {
    return this._statut === 'TERMINEE';
  }

  private assertPending(): void {
    if (this._statut !== 'EN_ATTENTE') {
      throw ReservationDomainError.notPending();
    }
  }

  private assertConfirmed(): void {
    if (this._statut !== 'CONFIRMEE') {
      throw ReservationDomainError.notConfirmed();
    }
  }

  static create(
    id: string,
    clientId: string,
    professionnelId: string,
    serviceId: string,
    dateHeure: Date,
    dureeMinutes: number,
    notes: string | null,
  ): ReservationEntity {
    if (!clientId) {
      throw ReservationDomainError.clientRequired();
    }
    if (!professionnelId) {
      throw ReservationDomainError.professionalRequired();
    }
    if (!serviceId) {
      throw ReservationDomainError.serviceRequired();
    }
    if (dateHeure <= new Date()) {
      throw ReservationDomainError.pastDateTime();
    }

    const entity = new ReservationEntity(
      id,
      clientId,
      professionnelId,
      serviceId,
      dateHeure,
      dureeMinutes,
      'EN_ATTENTE',
      notes,
      null,
      new Date(),
      new Date(),
    );

    entity.domainEvents.push(
      new ReservationCreated(
        id,
        clientId,
        professionnelId,
        serviceId,
        dateHeure,
        dureeMinutes,
        notes,
      ),
    );

    return entity;
  }

  static reconstitute(data: {
    id: string;
    clientId: string;
    professionnelId: string;
    serviceId: string;
    dateHeure: Date;
    dureeMinutes: number;
    statut: ReservationStatus;
    notes: string | null;
    raisonAnnulation: string | null;
    creeLe: Date;
    misAJourLe: Date;
  }): ReservationEntity {
    return new ReservationEntity(
      data.id,
      data.clientId,
      data.professionnelId,
      data.serviceId,
      data.dateHeure,
      data.dureeMinutes,
      data.statut,
      data.notes,
      data.raisonAnnulation,
      data.creeLe,
      data.misAJourLe,
    );
  }

  confirm(): void {
    this.assertPending();
    this._statut = 'CONFIRMEE';
    this.domainEvents.push(new ReservationConfirmed(this._id));
  }

  cancel(reason: string): void {
    if (this._statut === 'TERMINEE' || this._statut === 'ANNULEE') {
      throw ReservationDomainError.alreadyClosed();
    }
    this._statut = 'ANNULEE';
    this._raisonAnnulation = reason.trim() || null;
    this.domainEvents.push(new ReservationCancelled(this._id, reason.trim()));
  }

  markAsCompleted(): void {
    this.assertConfirmed();
    this._statut = 'TERMINEE';
    this.domainEvents.push(new ReservationCompleted(this._id));
  }

  markAsNoShow(): void {
    this.assertConfirmed();
    this._statut = 'NO_SHOW';
    this.domainEvents.push(new ReservationNoShow(this._id));
  }

  reschedule(newDateTime: Date): void {
    if (newDateTime <= new Date()) {
      throw ReservationDomainError.pastDateTime();
    }
    if (this._statut !== 'EN_ATTENTE' && this._statut !== 'CONFIRMEE') {
      throw ReservationDomainError.cannotReschedule();
    }
    this._dateHeure = newDateTime;
    this.domainEvents.push(
      new ReservationRescheduled(this._id, this._dateHeure, newDateTime),
    );
  }

  getDomainEvents(): readonly ReservationDomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  toView(): Reservation {
    return {
      id: this._id,
      clientId: this._clientId,
      professionnelId: this._professionnelId,
      serviceId: this._serviceId,
      dateHeure: this._dateHeure,
      dureeMinutes: this._dureeMinutes,
      statut: this._statut,
      notes: this._notes,
      raisonAnnulation: this._raisonAnnulation,
      creeLe: this._creeLe,
      misAJourLe: this._misAJourLe,
    };
  }
}

export type ReservationDomainEvent =
  | ReservationCreated
  | ReservationConfirmed
  | ReservationCancelled
  | ReservationCompleted
  | ReservationNoShow
  | ReservationRescheduled;

export class ReservationCreated {
  readonly type = 'ReservationCreated' as const;
  constructor(
    public readonly reservationId: string,
    public readonly clientId: string,
    public readonly professionnelId: string,
    public readonly serviceId: string,
    public readonly dateHeure: Date,
    public readonly dureeMinutes: number,
    public readonly notes: string | null,
  ) {}
}

export class ReservationConfirmed {
  readonly type = 'ReservationConfirmed' as const;
  constructor(public readonly reservationId: string) {}
}

export class ReservationCancelled {
  readonly type = 'ReservationCancelled' as const;
  constructor(
    public readonly reservationId: string,
    public readonly reason: string,
  ) {}
}

export class ReservationCompleted {
  readonly type = 'ReservationCompleted' as const;
  constructor(public readonly reservationId: string) {}
}

export class ReservationNoShow {
  readonly type = 'ReservationNoShow' as const;
  constructor(public readonly reservationId: string) {}
}

export class ReservationRescheduled {
  readonly type = 'ReservationRescheduled' as const;
  constructor(
    public readonly reservationId: string,
    public readonly oldDateTime: Date,
    public readonly newDateTime: Date,
  ) {}
}
