import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import { MaterialOrdersRealtimeService } from '../../../data-access/material-orders-realtime.service';
import {
  MaterialOrderView,
  MaterialOrdersService,
} from '../../../data-access/material-orders.service';

type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'CARD';

@Component({
  selector: 'app-material-order-payment-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppointmentTrackingStepperComponent],
  templateUrl: './material-order-payment-page.component.html',
  styleUrl:
    '../../../../pharmacy-orders/presentation/pages/pharmacy-order-payment-page/pharmacy-order-payment-page.component.scss',
})
export class MaterialOrderPaymentPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(MaterialOrdersService);
  private readonly realtime = inject(MaterialOrdersRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly backNavigation = inject(BackNavigationService);

  protected readonly order = signal<MaterialOrderView | null>(null);
  protected readonly loading = signal(true);
  protected readonly paying = signal(false);
  protected readonly updatingDelivery = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedMethod = signal<PaymentMethod>('WAVE');
  protected readonly steps: AppointmentTrackingStep[] = [
    { label: 'Quincaillerie', icon: 'circle', state: 'done' },
    { label: 'Matériel', icon: 'circle', state: 'done' },
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
      this.errorMessage.set('Commande de matériel introuvable.');
      this.loading.set(false);
      return;
    }
    this.realtime.connect();
    this.realtime.orderChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changedOrderId) => {
        if (changedOrderId === orderId && !this.paying()) this.load(orderId, false);
      });
    this.load(orderId, true);
  }

  protected goBack(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.backNavigation.back(null, id ? `/material-orders/${id}` : '/appointments', {
      preferReturnUrl: false,
    });
  }

  protected toggleDelivery(order: MaterialOrderView, requested: boolean): void {
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

  protected pay(order: MaterialOrderView): void {
    if (this.paying() || this.updatingDelivery()) return;
    this.paying.set(true);
    this.errorMessage.set(null);
    this.orders.initiatePayment(order.id, this.selectedMethod()).subscribe({
      next: (payment) => {
        if (payment.status === 'SUCCES') return void this.openAfterPayment(order.id);
        if (this.isHttpUrl(payment.paymentUrl)) {
          window.location.assign(payment.paymentUrl!);
          return;
        }
        this.orders
          .confirmMockPayment(order.id)
          .pipe(finalize(() => this.paying.set(false)))
          .subscribe({
            next: () => void this.openAfterPayment(order.id),
            error: (error) =>
              this.errorMessage.set(
                getHttpErrorMessage(error, 'Impossible de confirmer le paiement de test.'),
              ),
          });
      },
      error: (error) => {
        this.paying.set(false);
        this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'initialiser le paiement."));
      },
    });
  }

  private load(orderId: string, showLoader: boolean): void {
    if (showLoader) this.loading.set(true);
    this.orders
      .get(orderId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => {
          if (!['EN_ATTENTE_PAIEMENT', 'PARTIELLEMENT_DISPONIBLE'].includes(order.status)) {
            void this.router.navigate(['/material-orders', order.id], { replaceUrl: true });
            return;
          }
          this.order.set(order);
          this.errorMessage.set(null);
        },
        error: (error) =>
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger le paiement.')),
      });
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

  private openAfterPayment(orderId: string): Promise<boolean> {
    return this.router.navigate(['/material-orders', orderId], { replaceUrl: true });
  }
}
