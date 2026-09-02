import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import {
  MaterialOrderEligibility,
  MaterialOrdersService,
} from '../../../data-access/material-orders.service';

@Component({
  selector: 'app-material-order-entry',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './material-order-entry.component.html',
  styleUrl: './material-order-entry.component.scss',
})
export class MaterialOrderEntryComponent implements OnChanges {
  @Input({ required: true }) reservationId = '';
  @Input() returnUrl = '';

  private readonly orders = inject(MaterialOrdersService);
  protected readonly eligibility = signal<MaterialOrderEligibility | null>(null);

  ngOnChanges(): void {
    if (!this.reservationId) return;
    this.orders
      .getEligibility(this.reservationId)
      .pipe(catchError(() => of({ eligible: false, materialCount: 0, existingOrder: null })))
      .subscribe((eligibility) => this.eligibility.set(eligibility));
  }
}
