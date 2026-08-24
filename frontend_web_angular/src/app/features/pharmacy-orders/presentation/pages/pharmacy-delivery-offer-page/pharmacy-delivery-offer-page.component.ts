import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  PharmacyDeliveryOfferView,
  PharmacyOrdersService,
} from '../../../data-access/pharmacy-orders.service';

@Component({
  selector: 'app-pharmacy-delivery-offer-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './pharmacy-delivery-offer-page.component.html',
  styleUrl: './pharmacy-delivery-offer-page.component.scss',
})
export class PharmacyDeliveryOfferPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(PharmacyOrdersService);
  private readonly backNavigation = inject(BackNavigationService);

  protected readonly offer = signal<PharmacyDeliveryOfferView | null>(null);
  protected readonly loading = signal(true);
  protected readonly accepting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.errorMessage.set('Proposition de livraison introuvable.');
      this.loading.set(false);
      return;
    }
    this.orders
      .getDeliveryOffer(orderId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (offer) => this.offer.set(offer),
        error: (error) =>
          this.errorMessage.set(
            getHttpErrorMessage(error, "Cette livraison n'est plus disponible."),
          ),
      });
  }

  protected accept(offer: PharmacyDeliveryOfferView): void {
    if (this.accepting()) return;
    this.accepting.set(true);
    this.errorMessage.set(null);
    this.orders
      .acceptDelivery(offer.id)
      .pipe(finalize(() => this.accepting.set(false)))
      .subscribe({
        next: (order) => {
          const reservationId = order.deliveryReservation?.id;
          if (!reservationId) {
            this.errorMessage.set("La réservation de livraison n'a pas pu être ouverte.");
            return;
          }
          void this.router.navigate(['/appointments', reservationId], { replaceUrl: true });
        },
        error: (error) =>
          this.errorMessage.set(
            getHttpErrorMessage(
              error,
              "Cette livraison vient d'être acceptée par un autre livreur.",
            ),
          ),
      });
  }

  protected goBack(): void {
    this.backNavigation.back(null, '/appointments', { preferReturnUrl: false });
  }
}
