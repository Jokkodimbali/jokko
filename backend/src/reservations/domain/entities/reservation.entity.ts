import { ReservationDomainError } from '../errors/reservation.domain-error';

export type ReservationStatus =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

export type Reservation = {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: Date;
  adresseClient: string;
  dureeMinutes: number;
  statut: ReservationStatus;
  notes: string | null;
  prixConvenu: number | null;
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
    private readonly _adresseClient: string,
    private readonly _dureeMinutes: number,
    private _statut: ReservationStatus,
    private readonly _notes: string | null,
    private readonly _prixConvenu: number | null,
    private _raisonAnnulation: string | null,
    private readonly _creeLe: Date,
    private _misAJourLe: Date,
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

  get adresseClient(): string {
    return this._adresseClient;
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

  get prixConvenu(): number | null {
    return this._prixConvenu;
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

  static create(input: {
    id: string;
    clientId: string;
    professionnelId: string;
    serviceId: string;
    dateHeure: Date;
    adresseClient: string;
    dureeMinutes: number;
    notes?: string | null;
    prixConvenu?: number | null;
  }): ReservationEntity {
    this.assertRequiredInput(input.clientId, () =>
      ReservationDomainError.clientRequired(),
    );
    this.assertRequiredInput(input.professionnelId, () =>
      ReservationDomainError.professionalRequired(),
    );
    this.assertRequiredInput(input.serviceId, () =>
      ReservationDomainError.serviceRequired(),
    );
    this.assertRequiredInput(input.adresseClient, () =>
      ReservationDomainError.addressRequired(),
    );
    this.assertFutureDate(input.dateHeure);
    this.assertDuration(input.dureeMinutes);

    const now = new Date();
    return new ReservationEntity(
      input.id,
      input.clientId,
      input.professionnelId,
      input.serviceId,
      new Date(input.dateHeure),
      input.adresseClient.trim(),
      input.dureeMinutes,
      'EN_ATTENTE',
      this.normalizeText(input.notes),
      input.prixConvenu ?? null,
      null,
      now,
      now,
    );
  }

  static reconstitute(data: Reservation): ReservationEntity {
    this.assertValidDate(data.dateHeure);
    this.assertValidDate(data.creeLe);
    this.assertValidDate(data.misAJourLe);

    return new ReservationEntity(
      data.id,
      data.clientId,
      data.professionnelId,
      data.serviceId,
      new Date(data.dateHeure),
      data.adresseClient,
      data.dureeMinutes,
      data.statut,
      data.notes,
      data.prixConvenu,
      data.raisonAnnulation,
      new Date(data.creeLe),
      new Date(data.misAJourLe),
    );
  }

  confirm(): void {
    this.assertPending();
    this._statut = 'CONFIRMEE';
    this.touch();
  }

  cancel(reason?: string | null): void {
    if (!this.canBeCancelled()) {
      if (this.isFinalized()) {
        throw ReservationDomainError.alreadyClosed();
      } else {
        throw ReservationDomainError.cannotCancel();
      }
    }

    const normalizedReason = ReservationEntity.normalizeText(reason);
    this._statut = 'ANNULEE';
    this._raisonAnnulation = normalizedReason;
    this.touch();
  }

  markAsCompleted(): void {
    if (!this.canBeCompleted()) {
      throw ReservationDomainError.notActive();
    }

    this._statut = 'TERMINEE';
    this.touch();
  }

  markAsNoShow(): void {
    if (!this.canBeCompleted()) {
      throw ReservationDomainError.notActive();
    }

    this._statut = 'NO_SHOW';
    this.touch();
  }

  reschedule(newDateTime: Date): void {
    ReservationEntity.assertFutureDate(newDateTime);
    if (!this.canBeRescheduled()) {
      throw ReservationDomainError.cannotReschedule();
    }

    this._dateHeure = new Date(newDateTime);
    this._raisonAnnulation = null;
    this.touch();
  }

  toView(): Reservation {
    return {
      id: this._id,
      clientId: this._clientId,
      professionnelId: this._professionnelId,
      serviceId: this._serviceId,
      dateHeure: new Date(this._dateHeure),
      adresseClient: this._adresseClient,
      dureeMinutes: this._dureeMinutes,
      statut: this._statut,
      notes: this._notes,
      prixConvenu: this._prixConvenu,
      raisonAnnulation: this._raisonAnnulation,
      creeLe: new Date(this._creeLe),
      misAJourLe: new Date(this._misAJourLe),
    };
  }

  private assertPending(): void {
    if (this._statut !== 'EN_ATTENTE') {
      throw ReservationDomainError.notPending();
    }
  }

  private isFinalized(): boolean {
    return (
      this._statut === 'TERMINEE' ||
      this._statut === 'ANNULEE' ||
      this._statut === 'NO_SHOW'
    );
  }

  private canBeCancelled(): boolean {
    return (
      this._statut === 'EN_ATTENTE' ||
      this._statut === 'CONFIRMEE' ||
      this._statut === 'PAYEE_SEQUESTRE' ||
      this._statut === 'EN_COURS'
    );
  }

  private canBeCompleted(): boolean {
    return (
      this._statut === 'CONFIRMEE' ||
      this._statut === 'PAYEE_SEQUESTRE' ||
      this._statut === 'EN_COURS'
    );
  }

  private canBeRescheduled(): boolean {
    return (
      this._statut === 'EN_ATTENTE' ||
      this._statut === 'CONFIRMEE' ||
      this._statut === 'PAYEE_SEQUESTRE'
    );
  }

  private touch(): void {
    this._misAJourLe = new Date();
  }

  private static normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private static assertValidDate(value: Date): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw ReservationDomainError.invalidDateTime();
    }
  }

  private static assertFutureDate(dateHeure: Date): void {
    this.assertValidDate(dateHeure);
    if (dateHeure.getTime() <= Date.now()) {
      throw ReservationDomainError.pastDateTime();
    }
  }

  private static assertDuration(dureeMinutes: number): void {
    if (
      !Number.isInteger(dureeMinutes) ||
      dureeMinutes < 15 ||
      dureeMinutes > 1440
    ) {
      throw ReservationDomainError.invalidDuration();
    }
  }

  private static assertRequiredInput(
    value: string,
    errorFactory: () => Error,
  ): void {
    if (value.trim().length === 0) {
      throw errorFactory();
    }
  }
}
