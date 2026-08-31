import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { interval, startWith, switchMap } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import {
  PharmacyOrderView,
  PharmacyOrdersService,
} from '../../../data-access/pharmacy-orders.service';

@Component({
  selector: 'app-pharmacy-order-delivery-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppointmentTrackingStepperComponent],
  templateUrl: './pharmacy-order-delivery-page.component.html',
  styleUrl: './pharmacy-order-delivery-page.component.scss',
})
export class PharmacyOrderDeliveryPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(PharmacyOrdersService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly order = signal<PharmacyOrderView | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly steps: AppointmentTrackingStep[] = [
    { label: 'Pharmacie', icon: 'circle', state: 'done' },
    { label: 'Ordonnance', icon: 'circle', state: 'done' },
    { label: 'Paiement', icon: 'circle', state: 'done' },
    { label: 'Livraison', icon: 'circle', state: 'active' },
  ];

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.errorMessage.set('Commande pharmacie introuvable.');
      this.loading.set(false);
      return;
    }

    interval(4000)
      .pipe(
        startWith(0),
        switchMap(() => this.orders.get(orderId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          this.loading.set(false);
          this.errorMessage.set(null);
          this.order.set(order);
          const delivery = order.deliveryReservation;
          if (delivery?.id) {
            void this.router.navigate(['/appointments', delivery.id], {
              queryParams: { pharmacyOrderId: order.id },
              replaceUrl: true,
            });
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.errorMessage.set(
            getHttpErrorMessage(error, 'Impossible de charger le suivi de la livraison.'),
          );
        },
      });
  }

  protected goBack(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    this.backNavigation.back(null, orderId ? `/pharmacy-orders/${orderId}` : '/pharmacy-orders', {
      preferReturnUrl: false,
    });
  }
}
