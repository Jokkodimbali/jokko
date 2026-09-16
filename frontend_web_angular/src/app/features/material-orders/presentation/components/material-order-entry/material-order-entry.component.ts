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

  protected label(status: string | undefined): string {
    switch (status) {
      case 'EN_ATTENTE_QUINCAILLERIE': return 'Matériel en cours de vérification';
      case 'EN_ATTENTE_PAIEMENT':
      case 'PARTIELLEMENT_DISPONIBLE': return 'Voir le matériel et payer';
      case 'EN_ATTENTE_TRANSPORTEUR': return 'Recherche d’un livreur en cours';
      case 'TRANSPORTEUR_ASSIGNE':
      case 'EN_LIVRAISON': return 'Suivre la livraison de matériel';
      case 'LIVREE': return 'Voir la livraison terminée';
      case 'INDISPONIBLE': return 'Voir le matériel indisponible';
      case 'ANNULEE': return 'Voir la commande annulée';
      default: return 'Voir ma commande de matériel';
    }
  }
}
