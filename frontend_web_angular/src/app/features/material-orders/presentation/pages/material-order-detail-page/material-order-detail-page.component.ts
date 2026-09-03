import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import {
  MaterialOrderDecision,
  MaterialOrderItem,
  MaterialOrdersService,
  MaterialOrderView,
} from '../../../data-access/material-orders.service';
import { MaterialOrdersRealtimeService } from '../../../data-access/material-orders-realtime.service';
import {
  DoctorSpaceSection,
  DoctorSpaceSidebarComponent,
} from '../../../../medicine/presentation/pages/doctor-space-page/components/doctor-space-sidebar/doctor-space-sidebar.component';

@Component({
  selector: 'app-material-order-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AppointmentTrackingStepperComponent,
    DoctorSpaceSidebarComponent,
  ],
  templateUrl: './material-order-detail-page.component.html',
  styleUrl: './material-order-detail-page.component.scss',
})
export class MaterialOrderDetailPageComponent implements OnInit {
  private readonly orders = inject(MaterialOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthSessionService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly router = inject(Router);
  private readonly realtime = inject(MaterialOrdersRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly order = signal<MaterialOrderView | null>(null);
  protected readonly editableItems = signal<MaterialOrderItem[]>([]);
  protected readonly note = signal('');
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly acceptingDelivery = signal(false);
  protected readonly courierOfferMode =
    this.route.snapshot.routeConfig?.path?.endsWith('delivery-offer') === true;
  protected readonly error = signal<string | null>(null);
  protected readonly isHardwareStore = computed(
    () => this.order()?.hardwareStore.userId === this.auth.currentUser()?.id,
  );
  protected readonly showHardwareSidebar = computed(
    () =>
      !this.courierOfferMode &&
      (this.isHardwareStore() ||
        (!this.order() && this.auth.currentUser()?.role === 'PRESTATAIRE')),
  );
  protected readonly canValidate = computed(
    () => this.isHardwareStore() && this.order()?.status === 'EN_ATTENTE_QUINCAILLERIE',
  );
  protected readonly availableAmount = computed(() =>
    this.editableItems().reduce(
      (sum, item) => sum + (item.isAvailable ? Number(item.unitPrice ?? 0) * item.quantity : 0),
      0,
    ),
  );
  protected readonly currentStep = computed<1 | 2 | 3 | 4>(() => {
    const status = this.order()?.status;
    if (!status) return 1;
    if (status === 'EN_ATTENTE_QUINCAILLERIE' || status === 'INDISPONIBLE') return 2;
    if (status === 'EN_ATTENTE_PAIEMENT' || status === 'PARTIELLEMENT_DISPONIBLE') return 3;
    return 4;
  });
  protected readonly steps = computed<AppointmentTrackingStep[]>(() =>
    ['Quincaillerie', 'Materiel', 'Paiement', 'Livraison'].map((label, index) => ({
      label,
      icon: 'circle',
      state:
        index + 1 < this.currentStep()
          ? 'done'
          : index + 1 === this.currentStep()
            ? 'active'
            : 'pending',
    })),
  );
  protected readonly progress = computed(() => ((this.currentStep() - 1) / 3) * 82);

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.error.set('Commande materiel introuvable.');
      this.loading.set(false);
      return;
    }
    this.realtime.connect();
    this.realtime.orderChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changedOrderId) => {
        if (changedOrderId === orderId) this.loadOrder(orderId, false);
      });
    this.loadOrder(orderId, true);
  }

  protected trackItemByPosition(_index: number, item: MaterialOrderItem): number {
    return item.position;
  }

  protected openPayment(orderId: string): void {
    void this.router.navigate(['/material-orders', orderId, 'payment']);
  }

  private loadOrder(orderId: string, showLoader: boolean): void {
    if (showLoader) this.loading.set(true);
    const request = this.courierOfferMode
      ? this.orders.getDeliveryOffer(orderId)
      : this.orders.get(orderId);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (order) => this.hydrate(order),
      error: () => this.error.set('Impossible de charger cette commande materiel.'),
    });
  }

  protected goBack(): void {
    this.backNavigation.back(null, this.isHardwareStore() ? '/material-orders' : '/appointments');
  }

  protected openProviderSection(section: DoctorSpaceSection): void {
    void this.router.navigate(['/prestataire/espace'], { queryParams: { section } });
  }

  protected leaveProfessionalSpace(): void {
    void this.router.navigate(['/services']);
  }

  protected openHardwareRequests(): void {
    void this.router.navigate(['/material-orders']);
  }

  protected setAvailability(position: number, isAvailable: boolean): void {
    this.editableItems.update((items) =>
      items.map((item) =>
        item.position === position
          ? { ...item, isAvailable, unitPrice: isAvailable ? item.unitPrice : null }
          : item,
      ),
    );
  }

  protected updatePrice(position: number, value: number | null): void {
    this.editableItems.update((items) =>
      items.map((item) => (item.position === position ? { ...item, unitPrice: value } : item)),
    );
  }

  protected submitAvailability(): void {
    if (!this.canValidate() || this.submitting()) return;
    const items = this.editableItems();
    const availableCount = items.filter((item) => item.isAvailable).length;
    if (items.some((item) => item.isAvailable && Number(item.unitPrice) <= 0)) {
      this.error.set('Renseignez le prix de chaque article disponible.');
      return;
    }
    const decision: MaterialOrderDecision = {
      status:
        availableCount === 0
          ? 'INDISPONIBLE'
          : availableCount === items.length
            ? 'EN_ATTENTE_PAIEMENT'
            : 'PARTIELLEMENT_DISPONIBLE',
      note: this.note().trim() || undefined,
      items: items.map((item) => ({
        position: item.position,
        name: item.name,
        isAvailable: item.isAvailable,
        unitPrice: item.isAvailable ? Number(item.unitPrice) : undefined,
      })),
    };
    this.submitting.set(true);
    this.error.set(null);
    this.orders
      .validate(this.order()!.id, decision)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (order) => this.hydrate(order),
        error: (error: { error?: { message?: string } }) =>
          this.error.set(error.error?.message ?? 'Impossible de valider la disponibilite.'),
      });
  }

  protected acceptDelivery(): void {
    const order = this.order();
    if (!order || this.acceptingDelivery()) return;
    this.acceptingDelivery.set(true);
    this.error.set(null);
    this.orders
      .acceptDelivery(order.id)
      .pipe(finalize(() => this.acceptingDelivery.set(false)))
      .subscribe({
        next: (updated) => this.hydrate(updated),
        error: (error: { error?: { message?: string } }) =>
          this.error.set(error.error?.message ?? "Impossible d'accepter cette livraison."),
      });
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      EN_ATTENTE_QUINCAILLERIE: 'Verification en attente',
      EN_ATTENTE_PAIEMENT: 'Tout le materiel est disponible',
      PARTIELLEMENT_DISPONIBLE: 'Materiel partiellement disponible',
      INDISPONIBLE: 'Materiel indisponible',
      PAYEE_QUINCAILLERIE: 'Commande payee',
      EN_ATTENTE_TRANSPORTEUR: 'Recherche d’un livreur',
      TRANSPORTEUR_ASSIGNE: 'Livreur assigne',
      LIVREE: 'Materiel livre',
    };
    return labels[status] ?? status;
  }

  private hydrate(order: MaterialOrderView): void {
    this.order.set(order);
    this.editableItems.set(order.items.map((item) => ({ ...item })));
    this.note.set(order.note ?? '');
  }
}
