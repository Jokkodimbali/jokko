import { ReservationDomainError } from '../index';

export type ReservationStatus =
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

const FINALIZED_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'TERMINEE',
  'ANNULEE',
  'NO_SHOW',
]);
const CANCELLABLE_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'CONFIRMEE',
  'PAYEE_SEQUESTRE',
  'EN_COURS',
]);
const NO_SHOW_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'PAYEE_SEQUESTRE',
  'EN_COURS',
]);
const RESCHEDULABLE_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'CONFIRMEE',
  'PAYEE_SEQUESTRE',
]);
const DISPUTABLE_ACTIVE_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'PAYEE_SEQUESTRE',
  'EN_COURS',
]);

export type ReservationPriceAdjustmentStatus =
  | 'AUCUN'
  | 'EN_ATTENTE_CLIENT'
  | 'ACCEPTE'
  | 'REFUSE';

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
  statutAjustementPrix: ReservationPriceAdjustmentStatus;
  prixAjustementPropose: number | null;
  raisonAjustementPrix: string | null;
  demandeAjustementPrixLe: Date | null;
  raisonAnnulation: string | null;
  clientRating: number | null;
  clientReview: string | null;
  clientReviewedAt: Date | null;
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
    private _prixConvenu: number | null,
    private _statutAjustementPrix: ReservationPriceAdjustmentStatus,
    private _prixAjustementPropose: number | null,
    private _raisonAjustementPrix: string | null,
    private _demandeAjustementPrixLe: Date | null,
    private _raisonAnnulation: string | null,
    private _clientRating: number | null,
    private _clientReview: string | null,
    private _clientReviewedAt: Date | null,
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

  get statutAjustementPrix(): ReservationPriceAdjustmentStatus {
    return this._statutAjustementPrix;
  }

  get prixAjustementPropose(): number | null {
    return this._prixAjustementPropose;
  }

  get raisonAjustementPrix(): string | null {
    return this._raisonAjustementPrix;
  }

  get demandeAjustementPrixLe(): Date | null {
    return this._demandeAjustementPrixLe;
  }

  get raisonAnnulation(): string | null {
    return this._raisonAnnulation;
  }

  get clientRating(): number | null {
    return this._clientRating;
  }

  get clientReview(): string | null {
    return this._clientReview;
  }

  get clientReviewedAt(): Date | null {
    return this._clientReviewedAt;
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
      'CONFIRMEE',
      this.normalizeText(input.notes),
      input.prixConvenu ?? null,
      'AUCUN',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      now,
      now,
    );
  }

  static reconstitute(data: Reservation): ReservationEntity {
    this.assertValidDate(data.dateHeure);
    this.assertValidDate(data.creeLe);
    this.assertValidDate(data.misAJourLe);
    if (data.demandeAjustementPrixLe) {
      this.assertValidDate(data.demandeAjustementPrixLe);
    }
    if (data.clientReviewedAt) {
      this.assertValidDate(data.clientReviewedAt);
    }

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
      data.statutAjustementPrix,
      data.prixAjustementPropose,
      data.raisonAjustementPrix,
      data.demandeAjustementPrixLe
        ? new Date(data.demandeAjustementPrixLe)
        : null,
      data.raisonAnnulation,
      data.clientRating,
      data.clientReview,
      data.clientReviewedAt ? new Date(data.clientReviewedAt) : null,
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
    if (this.isFinalized()) {
      throw ReservationDomainError.alreadyClosed();
    }

    if (!this.canBeCancelled()) {
      throw ReservationDomainError.cannotCancel();
    }

    const normalizedReason = ReservationEntity.normalizeText(reason);
    this._statut = 'ANNULEE';
    this._raisonAnnulation = normalizedReason;
    this.touch();
  }

  markAsCompleted(): void {
    if (this._statut === 'CONFIRMEE') {
      throw ReservationDomainError.paymentRequired();
    }

    if (!this.canBeCompleted()) {
      throw ReservationDomainError.notActive();
    }

    this._statut = 'TERMINEE';
    this.touch();
  }

  markAsNoShow(): void {
    if (this._statut === 'CONFIRMEE') {
      throw ReservationDomainError.paymentRequired();
    }

    if (!this.canBeMarkedNoShow()) {
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

  markAsPaid(): void {
    if (!this.canBePaid()) {
      throw ReservationDomainError.cannotMarkAsPaid();
    }

    this._statut = 'PAYEE_SEQUESTRE';
    this.touch();
  }

  proposePriceAdjustment(input: {
    proposedPrice: number;
    reason?: string | null;
  }): void {
    if (this._statut !== 'CONFIRMEE') {
      throw ReservationDomainError.invalidPriceAdjustmentStatus();
    }

    if (this._statutAjustementPrix === 'EN_ATTENTE_CLIENT') {
      throw ReservationDomainError.priceAdjustmentAlreadyPending();
    }

    ReservationEntity.assertPositiveAmount(input.proposedPrice);

    if (
      this._prixConvenu !== null &&
      this._prixConvenu === input.proposedPrice
    ) {
      throw ReservationDomainError.unchangedPriceAdjustmentAmount();
    }

    this._statutAjustementPrix = 'EN_ATTENTE_CLIENT';
    this._prixAjustementPropose = input.proposedPrice;
    this._raisonAjustementPrix = ReservationEntity.normalizeText(input.reason);
    this._demandeAjustementPrixLe = new Date();
    this.touch();
  }

  acceptPriceAdjustment(): void {
    if (this._statut !== 'CONFIRMEE') {
      throw ReservationDomainError.invalidPriceAdjustmentStatus();
    }

    if (
      this._statutAjustementPrix !== 'EN_ATTENTE_CLIENT' ||
      this._prixAjustementPropose === null
    ) {
      throw ReservationDomainError.priceAdjustmentNotPending();
    }

    this._prixConvenu = this._prixAjustementPropose;
    this._statutAjustementPrix = 'ACCEPTE';
    this.touch();
  }

  rejectPriceAdjustment(): void {
    if (this._statut !== 'CONFIRMEE') {
      throw ReservationDomainError.invalidPriceAdjustmentStatus();
    }

    if (
      this._statutAjustementPrix !== 'EN_ATTENTE_CLIENT' ||
      this._prixAjustementPropose === null
    ) {
      throw ReservationDomainError.priceAdjustmentNotPending();
    }

    this._statutAjustementPrix = 'REFUSE';
    this.touch();
  }

  startReservation(): void {
    if (this._statut === 'CONFIRMEE') {
      throw ReservationDomainError.paymentRequired();
    }

    if (!this.canBeStarted()) {
      throw ReservationDomainError.cannotStart();
    }

    this._statut = 'EN_COURS';
    this.touch();
  }

  openDispute(reason: string): void {
    if (!this.canOpenDispute()) {
      throw ReservationDomainError.cannotOpenDispute();
    }

    this._statut = 'LITIGE';
    this._raisonAnnulation = reason;
    this.touch();
  }

  submitClientReview(input: { rating: number; review?: string | null }): void {
    if (this._statut !== 'TERMINEE') {
      throw ReservationDomainError.reviewRequiresCompletedReservation();
    }

    if (this._clientRating !== null || this._clientReviewedAt !== null) {
      throw ReservationDomainError.reviewAlreadySubmitted();
    }

    ReservationEntity.assertRating(input.rating);

    this._clientRating = input.rating;
    this._clientReview = ReservationEntity.normalizeText(input.review);
    this._clientReviewedAt = new Date();
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
      statutAjustementPrix: this._statutAjustementPrix,
      prixAjustementPropose: this._prixAjustementPropose,
      raisonAjustementPrix: this._raisonAjustementPrix,
      demandeAjustementPrixLe: this._demandeAjustementPrixLe
        ? new Date(this._demandeAjustementPrixLe)
        : null,
      raisonAnnulation: this._raisonAnnulation,
      clientRating: this._clientRating,
      clientReview: this._clientReview,
      clientReviewedAt: this._clientReviewedAt
        ? new Date(this._clientReviewedAt)
        : null,
      creeLe: new Date(this._creeLe),
      misAJourLe: new Date(this._misAJourLe),
    };
  }

  private assertPending(): void {
    throw ReservationDomainError.notPending();
  }

  private isFinalized(): boolean {
    return FINALIZED_RESERVATION_STATUSES.has(this._statut);
  }

  private canBeCancelled(): boolean {
    return (
      CANCELLABLE_RESERVATION_STATUSES.has(this._statut) &&
      this.isMoreThanHoursBefore(24)
    );
  }

  private canBeCompleted(): boolean {
    return this._statut === 'EN_COURS';
  }

  private canBeMarkedNoShow(): boolean {
    return NO_SHOW_RESERVATION_STATUSES.has(this._statut);
  }

  private canBeRescheduled(): boolean {
    if (!this.isMoreThanHoursBefore(24)) {
      throw ReservationDomainError.rescheduleTooLate();
    }
    return RESCHEDULABLE_RESERVATION_STATUSES.has(this._statut);
  }

  private canBePaid(): boolean {
    return this._statut === 'CONFIRMEE';
  }

  private canBeStarted(): boolean {
    return this._statut === 'PAYEE_SEQUESTRE';
  }

  private canOpenDispute(): boolean {
    return (
      this._statut === 'TERMINEE' ||
      this._statut === 'NO_SHOW' ||
      (DISPUTABLE_ACTIVE_RESERVATION_STATUSES.has(this._statut) &&
        this.isPastScheduledEnd())
    );
  }

  private isPastScheduledEnd(): boolean {
    const durationMinutes = Math.max(0, this._dureeMinutes || 0);
    const scheduledEnd = new Date(
      this._dateHeure.getTime() + durationMinutes * 60 * 1000,
    );
    return Date.now() >= scheduledEnd.getTime();
  }

  private isMoreThanHoursBefore(hours: number): boolean {
    const now = new Date();
    const hoursBefore = new Date(
      this._dateHeure.getTime() - hours * 60 * 60 * 1000,
    );
    return now < hoursBefore;
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

  private static assertPositiveAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ReservationDomainError.invalidPriceAdjustmentAmount();
    }
  }

  private static assertRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw ReservationDomainError.invalidReviewRating();
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
