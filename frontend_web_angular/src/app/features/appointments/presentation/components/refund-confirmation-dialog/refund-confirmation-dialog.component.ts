import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { AppointmentView } from '../../../domain/appointments.models';

@Component({
  selector: 'app-refund-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="refund-dialog__backdrop" (click)="!busy && cancel.emit()">
      <section class="refund-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" (click)="$event.stopPropagation()">
        <span class="refund-dialog__icon"><lucide-icon name="wallet-cards" size="27" /></span>
        <h2 id="refund-dialog-title">Voulez-vous vous faire rembourser ?</h2>
        <p>La réservation sera annulée et le remboursement sera demandé sur {{ methodLabel }}.</p>
        <strong>{{ (appointment.agreedPrice ?? appointment.servicePrice ?? 0) | number:'1.0-0' }} FCFA</strong>
        <div class="refund-dialog__actions">
          <button type="button" class="refund-dialog__cancel" [disabled]="busy" (click)="cancel.emit()">Annuler</button>
          <button type="button" class="refund-dialog__confirm" [disabled]="busy" (click)="confirm.emit()">{{ busy ? 'Traitement…' : 'Confirmer' }}</button>
        </div>
      </section>
    </div>
  `,
  styleUrl: './refund-confirmation-dialog.component.scss',
})
export class RefundConfirmationDialogComponent {
  @Input({ required: true }) appointment!: AppointmentView;
  @Input() busy = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  get methodLabel(): string {
    switch (this.appointment.paymentMethod) {
      case 'WAVE': return 'Wave';
      case 'ORANGE_MONEY': return 'Orange Money';
      case 'CARTE': return 'votre carte bancaire';
      default: return 'votre moyen de paiement initial';
    }
  }
}
