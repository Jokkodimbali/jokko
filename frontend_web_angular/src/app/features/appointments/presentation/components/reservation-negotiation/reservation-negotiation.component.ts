import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AppointmentView } from '../../../domain/appointments.models';

@Component({
  selector: 'app-reservation-negotiation',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './reservation-negotiation.component.html',
  styleUrl: './reservation-negotiation.component.scss',
})
export class ReservationNegotiationComponent implements OnChanges {
  @Input({ required: true }) appointment!: AppointmentView;
  @Input() providerViewer = false;
  @Input() handlingPriceAdjustment = false;

  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly reschedule = new EventEmitter<void>();
  @Output() readonly acceptPrice = new EventEmitter<void>();
  @Output() readonly rejectPrice = new EventEmitter<void>();
  @Output() readonly proposePrice = new EventEmitter<number>();

  protected readonly amount = signal(500);
  protected readonly step = signal(250);
  protected readonly priceAnimating = signal(false);
  protected readonly avatarFailed = signal(false);
  protected readonly steps = [100, 250, 500, 1000];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appointment']) {
      this.avatarFailed.set(false);
      this.amount.set(
        this.appointment.proposedAdjustedPrice ??
          this.appointment.agreedPrice ??
          this.appointment.servicePrice ??
          500,
      );
    }
  }

  protected get hasPendingAdjustment(): boolean {
    return (
      this.appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT' &&
      typeof this.appointment.proposedAdjustedPrice === 'number' &&
      Number.isFinite(this.appointment.proposedAdjustedPrice)
    );
  }

  protected get referencePrice(): number {
    return this.appointment.agreedPrice ?? this.appointment.servicePrice ?? 0;
  }

  protected get providerPrice(): number {
    return this.appointment.proposedAdjustedPrice ?? this.referencePrice;
  }

  protected get displayedPrice(): number {
    return this.hasPendingAdjustment ? this.providerPrice : Math.max(500, this.amount());
  }

  protected get canEdit(): boolean {
    return this.providerViewer && !this.hasPendingAdjustment && !this.handlingPriceAdjustment;
  }

  protected get statusLabel(): string {
    if (this.hasPendingAdjustment) {
      return this.providerViewer ? 'Proposition envoyee au client' : 'Nouvelle proposition recue';
    }
    if (this.appointment.priceAdjustmentStatus === 'ACCEPTE') return 'Prix negocie accepte';
    if (this.appointment.priceAdjustmentStatus === 'REFUSE') return 'Derniere proposition refusee';
    return this.providerViewer ? 'Proposez votre tarif final' : 'Tarif actuel de la reservation';
  }

  protected get priceStateLabel(): string {
    const labels: Record<AppointmentView['priceAdjustmentStatus'], string> = {
      AUCUN: 'Accord actuel',
      EN_ATTENTE_CLIENT: 'En attente',
      ACCEPTE: 'Accepte',
      REFUSE: 'Refuse',
    };
    return labels[this.appointment.priceAdjustmentStatus];
  }

  protected setStep(step: number): void {
    if (this.canEdit) this.step.set(step);
  }

  protected adjustAmount(direction: -1 | 1): void {
    if (!this.canEdit) return;
    this.amount.set(Math.max(500, Math.min(10_000_000, this.amount() + direction * this.step())));
    this.animatePrice();
  }

  protected setAmount(value: string | number): void {
    if (!this.canEdit) return;
    const amount = Math.trunc(Number(value));
    if (Number.isFinite(amount)) this.amount.set(Math.max(500, Math.min(10_000_000, amount)));
  }

  protected submitProposal(): void {
    if (!this.canEdit || this.amount() === this.referencePrice) return;
    this.proposePrice.emit(this.amount());
  }

  protected formatPrice(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0)} FCFA`;
  }

  protected avatarInitials(): string {
    return (
      this.appointment.doctorName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'JD'
    );
  }

  protected useInitials(): void {
    this.avatarFailed.set(true);
  }

  private animatePrice(): void {
    this.priceAnimating.set(false);
    window.setTimeout(() => this.priceAnimating.set(true), 0);
    window.setTimeout(() => this.priceAnimating.set(false), 240);
  }
}
