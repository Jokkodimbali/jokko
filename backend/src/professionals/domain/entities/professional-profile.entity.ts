import {
  ProfessionalProfileCreated,
  ProfessionalProfileUpdated,
  ProfessionalKycSubmitted,
  ProfessionalKycApproved,
  ProfessionalKycRejected,
} from '../events/professional.events';
import { UserRoleVO, type UserRole } from '../value-objects/user-role.vo';
import { ProfessionalDomainError } from '../errors/professional.domain-error';

export type KycStatus = 'EN_ATTENTE' | 'VERIFIE' | 'REJETE' | 'NON_SOUMIS';

/**
 * Aggregate Root for the Professional Profile bounded entity.
 * Encapsulates all invariants and publishes domain events on state changes.
 */
export class ProfessionalProfile {
  private constructor(
    private readonly _id: string,
    private readonly _utilisateurId: string,
    private _biographie: string | null,
    private _nomEntreprise: string | null,
    private _urlPieceIdentiteRecto: string | null,
    private _urlPieceIdentiteVerso: string | null,
    private _statutKyc: KycStatus,
    private _raisonRejetKyc: string | null,
    private _ville: string | null,
    private _noteGlobale: number,
    private _nombreAvis: number,
    private readonly _creeLe: Date,
    private readonly domainEvents: (
      | ProfessionalProfileCreated
      | ProfessionalProfileUpdated
      | ProfessionalKycSubmitted
      | ProfessionalKycApproved
      | ProfessionalKycRejected
    )[] = [],
  ) {}

  // ─── Getters ───────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get utilisateurId(): string {
    return this._utilisateurId;
  }

  get biographie(): string | null {
    return this._biographie;
  }

  get nomEntreprise(): string | null {
    return this._nomEntreprise;
  }

  get urlPieceIdentiteRecto(): string | null {
    return this._urlPieceIdentiteRecto;
  }

  get urlPieceIdentiteVerso(): string | null {
    return this._urlPieceIdentiteVerso;
  }

  get statutKyc(): KycStatus {
    return this._statutKyc;
  }

  get raisonRejetKyc(): string | null {
    return this._raisonRejetKyc;
  }

  get ville(): string | null {
    return this._ville;
  }

  get noteGlobale(): number {
    return this._noteGlobale;
  }

  get nombreAvis(): number {
    return this._nombreAvis;
  }

  get creeLe(): Date {
    return this._creeLe;
  }

  // ─── Business Rules / Invariants ──────────────────────────────────────────

  get isKycVerified(): boolean {
    return this._statutKyc === 'VERIFIE';
  }

  get isKycPending(): boolean {
    return this._statutKyc === 'EN_ATTENTE';
  }

  get isKycRejected(): boolean {
    return this._statutKyc === 'REJETE';
  }

  private assertKycNotSubmitted(): void {
    if (this._statutKyc !== 'NON_SOUMIS' && this._statutKyc !== 'REJETE') {
      throw ProfessionalDomainError.kycAlreadySubmitted();
    }
  }

  private assertKycSubmitted(): void {
    if (this._statutKyc !== 'EN_ATTENTE') {
      throw ProfessionalDomainError.kycNotSubmitted();
    }
  }

  // ─── Factory Methods ──────────────────────────────────────────────────────

  static create(
    id: string,
    utilisateurId: string,
    biographie: string | null,
    nomEntreprise: string | null,
    ville: string | null,
  ): ProfessionalProfile {
    const profile = new ProfessionalProfile(
      id,
      utilisateurId,
      biographie,
      nomEntreprise,
      null, // urlPieceIdentiteRecto
      null, // urlPieceIdentiteVerso
      'NON_SOUMIS', // statutKyc
      null, // raisonRejetKyc
      ville,
      0, // noteGlobale
      0, // nombreAvis
      new Date(),
    );

    profile.domainEvents.push(
      new ProfessionalProfileCreated(
        id,
        utilisateurId,
        biographie,
        nomEntreprise,
        ville,
      ),
    );

    return profile;
  }

  static reconstitute(data: {
    id: string;
    utilisateurId: string;
    biographie: string | null;
    nomEntreprise: string | null;
    urlPieceIdentiteRecto: string | null;
    urlPieceIdentiteVerso: string | null;
    statutKyc: KycStatus;
    raisonRejetKyc: string | null;
    ville: string | null;
    noteGlobale: number;
    nombreAvis: number;
    creeLe: Date;
  }): ProfessionalProfile {
    return new ProfessionalProfile(
      data.id,
      data.utilisateurId,
      data.biographie,
      data.nomEntreprise,
      data.urlPieceIdentiteRecto,
      data.urlPieceIdentiteVerso,
      data.statutKyc,
      data.raisonRejetKyc,
      data.ville,
      data.noteGlobale,
      data.nombreAvis,
      data.creeLe,
    );
  }

  // ─── Behavior Methods ─────────────────────────────────────────────────────

  submitKyc(idCardUrlRecto: string, idCardUrlVerso: string | null): void {
    this.assertKycNotSubmitted();
    this._urlPieceIdentiteRecto = idCardUrlRecto;
    this._urlPieceIdentiteVerso = idCardUrlVerso;
    this._statutKyc = 'EN_ATTENTE';
    this._raisonRejetKyc = null;

    this.domainEvents.push(
      new ProfessionalKycSubmitted(this._id, idCardUrlRecto, idCardUrlVerso),
    );
  }

  approveKyc(): void {
    this.assertKycSubmitted();
    this._statutKyc = 'VERIFIE';
    this._raisonRejetKyc = null;

    this.domainEvents.push(new ProfessionalKycApproved(this._id));
  }

  rejectKyc(reason: string): void {
    this.assertKycSubmitted();
    if (reason.trim().length === 0) {
      throw ProfessionalDomainError.rejectReasonEmpty();
    }
    this._statutKyc = 'REJETE';
    this._raisonRejetKyc = reason.trim();

    this.domainEvents.push(
      new ProfessionalKycRejected(this._id, reason.trim()),
    );
  }

  updateProfile(
    biographie: string | null,
    nomEntreprise: string | null,
    ville: string | null,
  ): void {
    this._biographie = biographie;
    this._nomEntreprise = nomEntreprise;
    this._ville = ville;

    this.domainEvents.push(
      new ProfessionalProfileUpdated(
        this._id,
        biographie,
        nomEntreprise,
        ville,
      ),
    );
  }

  updateRating(newRating: number): void {
    if (newRating < 0 || newRating > 5) {
      throw ProfessionalDomainError.invalidRating(newRating);
    }
    this._noteGlobale = newRating;
    this._nombreAvis += 1;
  }

  // ─── Domain Events ────────────────────────────────────────────────────────

  getDomainEvents(): readonly (
    | ProfessionalProfileCreated
    | ProfessionalProfileUpdated
    | ProfessionalKycSubmitted
    | ProfessionalKycApproved
    | ProfessionalKycRejected
  )[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  // ─── Static Helpers (decoupled from infrastructure) ───────────────────────

  static isProfessionalRole(role: UserRole): boolean {
    return UserRoleVO.create(role).isProfessional();
  }

  static isAdminRole(role: UserRole): boolean {
    return UserRoleVO.create(role).isAdmin();
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  toView(): {
    id: string;
    utilisateurId: string;
    biographie: string | null;
    nomEntreprise: string | null;
    urlPieceIdentiteRecto: string | null;
    urlPieceIdentiteVerso: string | null;
    statutKyc: KycStatus;
    raisonRejetKyc: string | null;
    ville: string | null;
    noteGlobale: number;
    nombreAvis: number;
    creeLe: Date;
  } {
    return {
      id: this._id,
      utilisateurId: this._utilisateurId,
      biographie: this._biographie,
      nomEntreprise: this._nomEntreprise,
      urlPieceIdentiteRecto: this._urlPieceIdentiteRecto,
      urlPieceIdentiteVerso: this._urlPieceIdentiteVerso,
      statutKyc: this._statutKyc,
      raisonRejetKyc: this._raisonRejetKyc,
      ville: this._ville,
      noteGlobale: this._noteGlobale,
      nombreAvis: this._nombreAvis,
      creeLe: this._creeLe,
    };
  }
}
