import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import {
  PharmacyOrderView,
  PharmacyOrdersService,
} from '../../../data-access/pharmacy-orders.service';

@Component({
  selector: 'app-pharmacy-order-entry',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './pharmacy-order-entry.component.html',
  styleUrl: './pharmacy-order-entry.component.scss',
})
export class PharmacyOrderEntryComponent implements OnChanges {
  @Input({ required: true }) reservationId = '';
  @Input() returnUrl = '';

  private readonly orders = inject(PharmacyOrdersService);
  protected readonly order = signal<PharmacyOrderView | null>(null);

  ngOnChanges(): void {
    if (!this.reservationId) return;
    this.orders.list().pipe(
      catchError(() => of([] as PharmacyOrderView[])),
    ).subscribe((orders) => {
      this.order.set(orders.find((order) => order.medicalReservation.id === this.reservationId) ?? null);
    });
  }

  protected label(order: PharmacyOrderView | null): string {
    if (!order) return 'Rechercher une pharmacie';
    switch (order.status) {
      case 'EN_ATTENTE_PHARMACIE': return 'Ordonnance en cours de vérification';
      case 'EN_ATTENTE_PAIEMENT':
      case 'PARTIELLEMENT_DISPONIBLE': return 'Voir l’ordonnance et payer';
      case 'EN_ATTENTE_TRANSPORTEUR': return 'Recherche d’un livreur en cours';
      case 'TRANSPORTEUR_ASSIGNE':
      case 'EN_LIVRAISON': return 'Suivre la livraison de médicaments';
      case 'LIVREE': return 'Voir la livraison terminée';
      case 'INDISPONIBLE': return 'Voir les médicaments indisponibles';
      case 'ANNULEE': return 'Voir la commande annulée';
      default: return order.deliveryRequested ? 'Suivre la livraison de médicaments' : 'Voir ma commande de médicaments';
    }
  }

  protected icon(order: PharmacyOrderView | null): string {
    return order ? 'arrow-right' : 'stethoscope';
  }
}
