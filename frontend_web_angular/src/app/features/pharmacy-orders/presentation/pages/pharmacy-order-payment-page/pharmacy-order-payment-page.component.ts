import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import {
  PharmacyOrderMedicineItem,
  PharmacyOrderView,
  PharmacyOrdersService,
} from '../../../data-access/pharmacy-orders.service';

type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'CARD';

@Component({
  selector: 'app-pharmacy-order-payment-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppointmentTrackingStepperComponent],
  templateUrl: './pharmacy-order-payment-page.component.html',
  styleUrl: './pharmacy-order-payment-page.component.scss',
})
export class PharmacyOrderPaymentPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(PharmacyOrdersService);
  private readonly backNavigation = inject(BackNavigationService);

  protected readonly order = signal<PharmacyOrderView | null>(null);
  protected readonly loading = signal(true);
  protected readonly paying = signal(false);
  protected readonly updatingDelivery = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedMethod = signal<PaymentMethod>('WAVE');
  protected readonly steps: AppointmentTrackingStep[] = [
    { label: 'Pharmacie', icon: 'circle', state: 'done' },
    { label: 'Ordonnance', icon: 'circle', state: 'done' },
    { label: 'Paiement', icon: 'circle', state: 'active' },
    { label: 'Livraison', icon: 'circle', state: 'pending' },
  ];
  protected readonly methods: Array<{
    id: PaymentMethod;
    label: string;
    subtitle: string;
    logo: string;
  }> = [
    { id: 'WAVE', label: 'Wave', subtitle: 'Paiement mobile sécurisé', logo: '/wave.png' },
    {
      id: 'ORANGE_MONEY',
      label: 'Orange Money',
      subtitle: 'Payer avec votre compte Orange Money',
      logo: '/Orange-Money-logo.png',
    },
    {
      id: 'CARD',
      label: 'Carte bancaire',
      subtitle: 'Visa ou Mastercard',
      logo: '/logo vissa.avif',
    },
  ];

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.errorMessage.set('Commande pharmacie introuvable.');
      this.loading.set(false);
      return;
    }
    this.orders
      .get(orderId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => {
          if (
            [
              'PAYEE_PHARMACIE',
              'EN_ATTENTE_TRANSPORTEUR',
              'TRANSPORTEUR_ASSIGNE',
              'EN_LIVRAISON',
              'LIVREE',
            ].includes(order.status)
          ) {
            const target = order.deliveryRequested
              ? ['/pharmacy-orders', order.id, 'delivery']
              : ['/pharmacy-orders', order.id];
            void this.router.navigate(target, {
              replaceUrl: true,
            });
            return;
          }
          if (
            !['EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_DISPONIBLE'].includes(order.status) ||
            order.medicineAmount === null
          ) {
            this.errorMessage.set("Cette commande n'est pas disponible pour le paiement.");
            return;
          }
          this.order.set(order);
        },
        error: (error) =>
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger le paiement.')),
      });
  }

  protected goBack(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.backNavigation.back(null, id ? `/pharmacy-orders/${id}` : '/pharmacy-orders', {
      preferReturnUrl: false,
    });
  }

  protected pay(order: PharmacyOrderView): void {
    if (this.paying() || this.updatingDelivery()) return;
    this.paying.set(true);
    this.errorMessage.set(null);
    this.orders
      .initiatePayment(order.id, this.selectedMethod(), order.deliveryRequested)
      .subscribe({
        next: (payment) => {
          if (payment.status === 'SUCCES') {
            void this.openAfterPayment(order);
            return;
          }
          if (this.isHttpUrl(payment.paymentUrl)) {
            window.location.assign(payment.paymentUrl!);
            return;
          }

          this.orders
            .confirmMockPayment(order.id)
            .pipe(finalize(() => this.paying.set(false)))
            .subscribe({
              next: () => void this.openAfterPayment(order),
              error: (error) =>
                this.errorMessage.set(
                  getHttpErrorMessage(error, 'Impossible de confirmer le paiement de test.'),
                ),
            });
        },
        error: (error) => {
          this.errorMessage.set(
            getHttpErrorMessage(error, "Impossible d'initialiser le paiement."),
          );
          this.paying.set(false);
        },
      });
  }

  protected toggleDelivery(order: PharmacyOrderView, requested: boolean): void {
    if (this.updatingDelivery() || this.paying()) return;
    this.updatingDelivery.set(true);
    this.errorMessage.set(null);
    this.orders
      .configureDelivery(order.id, requested)
      .pipe(finalize(() => this.updatingDelivery.set(false)))
      .subscribe({
        next: (updated) => this.order.set(updated),
        error: (error) =>
          this.errorMessage.set(
            getHttpErrorMessage(error, 'Impossible de mettre à jour le choix de livraison.'),
          ),
      });
  }

  protected medicines(order: PharmacyOrderView): string[] {
    return [
      ...order.medicalReservation.prescription.acts,
      ...order.medicalReservation.prescription.vaccines,
      ...order.medicalReservation.prescription.treatments,
    ].filter(Boolean);
  }

  protected medicineItems(order: PharmacyOrderView): PharmacyOrderMedicineItem[] {
    if (order.medicineItems.length > 0) return order.medicineItems;
    const unavailable = new Set(order.unavailableItems.map((name) => name.trim().toLowerCase()));
    return this.medicines(order).map((name, position) => ({
      position,
      name,
      isAvailable: !unavailable.has(name.trim().toLowerCase()),
      price: null,
    }));
  }

  protected prescriptionReference(order: PharmacyOrderView): string {
    return order.medicalReservation.id.slice(0, 8).toUpperCase();
  }

  private isHttpUrl(url: string | null): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private openAfterPayment(order: PharmacyOrderView): Promise<boolean> {
    const target = order.deliveryRequested
      ? ['/pharmacy-orders', order.id, 'delivery']
      : ['/pharmacy-orders', order.id];
    return this.router.navigate(target, {
      replaceUrl: true,
    });
  }
}
