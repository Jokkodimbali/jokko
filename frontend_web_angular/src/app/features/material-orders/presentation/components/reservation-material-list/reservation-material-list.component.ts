import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessagesRealtimeService } from '../../../../messages/data-access/messages-realtime.service';
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  ServiceProposalService,
  MaterialQuoteView,
} from '../../../../services/data-access/service-proposal.service';
import { MaterialOrderEntryComponent } from '../material-order-entry/material-order-entry.component';

@Component({
  selector: 'app-reservation-material-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialOrderEntryComponent],
  templateUrl: './reservation-material-list.component.html',
  styleUrl: './reservation-material-list.component.scss',
})
export class ReservationMaterialListComponent implements OnChanges {
  @Input({ required: true }) reservationId = '';
  @Input() status = '';
  @Input() isProvider = false;
  private readonly api = inject(ServiceProposalService);
  protected readonly items = signal<MaterialQuoteView[]>([]);
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected editing = false;
  protected rows = [{ designation: '', quantity: 1 }];

  constructor() {
    inject(MessagesRealtimeService)
      .notificationCreated$.pipe(takeUntilDestroyed())
      .subscribe((notification) => {
        const data = notification.data || notification.donnees || {};
        if (data['materialList'] === true && data['reservationId'] === this.reservationId)
          this.load();
      });
  }

  protected get canAdd(): boolean {
    return this.isProvider && ['CONFIRMEE', 'PAYEE_SEQUESTRE'].includes(this.status);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reservationId']) {
      this.items.set([]);
      this.rows = [{ designation: '', quantity: 1 }];
      this.editing = false;
      this.success.set('');
    }
    this.load();
  }

  protected load(): void {
    if (!this.reservationId) return;
    const id = this.reservationId;
    this.loading.set(true);
    this.error.set('');
    this.api.listReservationMaterialQuotes(id).subscribe({
      next: (items) => {
        if (id !== this.reservationId) return;
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        if (id !== this.reservationId) return;
        this.loading.set(false);
        this.error.set('Impossible de charger la liste du matériel. Réessayez.');
      },
    });
  }

  protected addRow(): void {
    if (this.rows.length < 50) this.rows.push({ designation: '', quantity: 1 });
  }

  protected removeRow(index: number): void {
    this.rows.splice(index, 1);
  }

  protected save(): void {
    if (!this.canAdd || this.saving()) return;
    if (
      !this.rows.length ||
      this.rows.some(
        (row) =>
          !row.designation.trim() ||
          row.designation.trim().length > 180 ||
          !Number.isInteger(row.quantity) ||
          row.quantity < 1 ||
          row.quantity > 1000,
      )
    ) {
      this.error.set('Renseignez chaque article et une quantité entière entre 1 et 1 000.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.api
      .createReservationMaterialList(
        this.reservationId,
        this.rows.map((row) => ({ ...row, designation: row.designation.trim(), unitPrice: 0 })),
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (items) => {
          this.items.update((existing) => [...existing, ...items]);
          this.editing = false;
          this.rows = [{ designation: '', quantity: 1 }];
          this.success.set('La liste a été envoyée. Le client a été notifié.');
        },
        error: () =>
          this.error.set(
            'Impossible d’envoyer le matériel. Actualisez la liste avant de réessayer.',
          ),
      });
  }
}
