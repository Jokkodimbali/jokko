import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EMPTY, catchError, exhaustMap, finalize, takeWhile, timer } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { userInitials } from '../../../../../shared/utils/user-initials';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import {
  PharmacyOrderMedicineItem,
  PharmacyOrderView,
  PharmacyOrderDecision,
  PharmacyOrdersService,
} from '../../../data-access/pharmacy-orders.service';

@Component({
  selector: 'app-pharmacy-order-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, AppointmentTrackingStepperComponent],
  templateUrl: './pharmacy-order-detail-page.component.html',
  styleUrls: [
    './pharmacy-order-detail-page.component.scss',
    './_pharmacy-medicine-availability.scss',
  ],
})
export class PharmacyOrderDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(PharmacyOrdersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);

  protected readonly order = signal<PharmacyOrderView | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly decisionError = signal<string | null>(null);
  protected decisionStatus: PharmacyOrderDecision['status'] = 'EN_ATTENTE_PAIEMENT';
  protected pharmacyNote = '';
  protected medicineItems: PharmacyOrderMedicineItem[] = [];
  protected readonly isPharmacyViewer = computed(
    () => this.authSession.currentUser()?.id === this.order()?.pharmacy.userId,
  );
  protected readonly steps = computed<AppointmentTrackingStep[]>(() => {
    const currentStep = this.currentStep(this.order()?.status);
    return ['Pharmacie', 'Ordonnance', 'Paiement', 'Livraison'].map((label, index) => ({
      label,
      icon: 'circle',
      state: index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'active' : 'pending',
    }));
  });
  protected readonly progress = computed(
    () => ((this.currentStep(this.order()?.status) - 1) / 3) * 82,
  );

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.errorMessage.set('Commande pharmacie introuvable.');
      this.isLoading.set(false);
      return;
    }

    timer(0, 4_000)
      .pipe(
        exhaustMap(() =>
          this.orders.get(orderId).pipe(
            catchError((error) => {
              if (!this.order()) {
                this.isLoading.set(false);
                this.errorMessage.set(
                  getHttpErrorMessage(error, 'Impossible de charger cette commande pharmacie.'),
                );
              }
              return EMPTY;
            }),
          ),
        ),
        takeWhile((order) => order.status === 'EN_ATTENTE_PHARMACIE', true),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((order) => {
        this.initializeMedicineItems(order);
        this.order.set(order);
        this.errorMessage.set(null);
        this.isLoading.set(false);
        if (
          !this.isPharmacyViewer() &&
          [
            'PAYEE_PHARMACIE',
            'EN_ATTENTE_TRANSPORTEUR',
            'TRANSPORTEUR_ASSIGNE',
            'EN_LIVRAISON',
            'LIVREE',
          ].includes(order.status)
        ) {
          void this.router.navigate(['/pharmacy-orders', order.id, 'delivery'], {
            replaceUrl: true,
          });
        }
      });
  }

  protected goBack(): void {
    const reservationId = this.order()?.medicalReservation.id;
    const fallback = this.isPharmacyViewer()
      ? '/pharmacy-orders'
      : reservationId
        ? `/appointments/${reservationId}`
        : '/appointments';
    this.backNavigation.back(this.route.snapshot.queryParamMap.get('returnUrl'), fallback, {
      preferReturnUrl: true,
    });
  }

  protected medicines(order: PharmacyOrderView): string[] {
    return [
      ...order.medicalReservation.prescription.acts,
      ...order.medicalReservation.prescription.vaccines,
      ...order.medicalReservation.prescription.treatments,
    ].filter(Boolean);
  }

  protected medicineItemsForDisplay(order: PharmacyOrderView): PharmacyOrderMedicineItem[] {
    if (order.medicineItems.length > 0) return order.medicineItems;
    const unavailable = new Set(order.unavailableItems.map((name) => name.trim().toLowerCase()));
    return this.medicines(order).map((name, position) => ({
      position,
      name,
      isAvailable: !unavailable.has(name.trim().toLowerCase()),
      price: null,
    }));
  }

  protected initials(name: string): string {
    return userInitials(name);
  }

  protected prescriptionReference(order: PharmacyOrderView): string {
    return order.medicalReservation.id.slice(0, 8).toUpperCase();
  }

  protected isAccepted(status: string): boolean {
    return status === 'EN_ATTENTE_PAIEMENT' || status === 'PARTIELLEMENT_DISPONIBLE';
  }

  protected onDecisionStatusChange(status: PharmacyOrderDecision['status']): void {
    this.decisionStatus = status;
    if (status === 'EN_ATTENTE_PAIEMENT') {
      this.medicineItems.forEach((item) => (item.isAvailable = true));
      return;
    }
    if (status === 'INDISPONIBLE') {
      this.medicineItems.forEach((item) => {
        item.isAvailable = false;
        item.price = null;
      });
      return;
    }
    if (this.medicineItems.length > 1 && this.medicineItems.every((item) => item.isAvailable)) {
      const lastItem = this.medicineItems[this.medicineItems.length - 1];
      lastItem.isAvailable = false;
      lastItem.price = null;
    }
  }

  protected setMedicineAvailability(item: PharmacyOrderMedicineItem, available: boolean): void {
    item.isAvailable = available;
    if (!available) item.price = null;
  }

  protected medicineTotal(): number {
    return this.medicineItems.reduce(
      (total, item) => total + (item.isAvailable ? Number(item.price) || 0 : 0),
      0,
    );
  }

  protected submitDecision(order: PharmacyOrderView): void {
    if (order.status !== 'EN_ATTENTE_PHARMACIE' || this.isSubmitting()) return;

    const availableItems = this.medicineItems.filter((item) => item.isAvailable);
    const unavailableItems = this.medicineItems.filter((item) => !item.isAvailable);
    if (availableItems.some((item) => !Number.isFinite(item.price) || (item.price ?? 0) <= 0)) {
      this.decisionError.set('Renseignez le prix de chaque médicament disponible.');
      return;
    }
    if (
      this.decisionStatus === 'PARTIELLEMENT_DISPONIBLE' &&
      (availableItems.length === 0 || unavailableItems.length === 0)
    ) {
      this.decisionError.set(
        'Marquez au moins un médicament disponible et un médicament indisponible.',
      );
      return;
    }
    if (this.decisionStatus === 'INDISPONIBLE' && !this.pharmacyNote.trim()) {
      this.decisionError.set("Précisez pourquoi l'ordonnance est indisponible.");
      return;
    }

    const decision: PharmacyOrderDecision = {
      status: this.decisionStatus,
      pharmacyNote: this.pharmacyNote.trim() || undefined,
      medicineItems: this.medicineItems.map((item) => ({
        position: item.position,
        name: item.name,
        isAvailable: item.isAvailable,
        ...(item.isAvailable ? { price: Number(item.price) } : {}),
      })),
    };
    this.isSubmitting.set(true);
    this.decisionError.set(null);
    this.orders
      .validate(order.id, decision)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.feedback.success('La réponse a été envoyée au patient.');
        },
        error: (error) =>
          this.decisionError.set(
            getHttpErrorMessage(error, 'Impossible de traiter cette ordonnance.'),
          ),
      });
  }

  protected statusLabel(status: string): string {
    return (
      (
        {
          EN_ATTENTE_PHARMACIE: 'À vérifier',
          EN_ATTENTE_PAIEMENT: 'Acceptée — paiement attendu',
          PARTIELLEMENT_DISPONIBLE: 'Partiellement disponible',
          INDISPONIBLE: 'Indisponible',
          PAYEE_PHARMACIE: 'Payée',
          EN_ATTENTE_TRANSPORTEUR: 'En attente de livraison',
          TRANSPORTEUR_ASSIGNE: 'Livreur assigné',
          EN_LIVRAISON: 'En livraison',
          LIVREE: 'Livrée',
        } as Record<string, string>
      )[status] ?? status
    );
  }

  protected proceedToPayment(order: PharmacyOrderView): void {
    if (!this.isAccepted(order.status) || order.medicineAmount === null) return;
    void this.router.navigate(['/pharmacy-orders', order.id, 'payment']);
  }

  private currentStep(status?: string): 1 | 2 | 3 | 4 {
    if (status === 'PAYEE_PHARMACIE') return 4;
    if (
      status &&
      ['EN_ATTENTE_TRANSPORTEUR', 'TRANSPORTEUR_ASSIGNE', 'EN_LIVRAISON', 'LIVREE'].includes(status)
    ) {
      return 4;
    }
    return 2;
  }

  private initializeMedicineItems(order: PharmacyOrderView): void {
    if (order.medicineItems.length > 0) {
      this.medicineItems = order.medicineItems.map((item) => ({ ...item }));
      return;
    }
    if (this.medicineItems.length > 0) return;
    this.medicineItems = this.medicines(order).map((name, position) => ({
      position,
      name,
      isAvailable: true,
      price: null,
    }));
  }
}
