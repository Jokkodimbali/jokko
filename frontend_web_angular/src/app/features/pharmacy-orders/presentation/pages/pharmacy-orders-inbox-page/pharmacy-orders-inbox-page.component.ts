import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { asapScheduler, finalize, observeOn } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import {
  DoctorSpaceSection,
  DoctorSpaceSidebarComponent,
} from '../../../../medicine/presentation/pages/doctor-space-page/components/doctor-space-sidebar/doctor-space-sidebar.component';
import {
  PharmacyOrderView,
  PharmacyOrdersService,
} from '../../../data-access/pharmacy-orders.service';

@Component({
  selector: 'app-pharmacy-orders-inbox-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, DoctorSpaceSidebarComponent],
  templateUrl: './pharmacy-orders-inbox-page.component.html',
  styleUrl: './pharmacy-orders-inbox-page.component.scss',
})
export class PharmacyOrdersInboxPageComponent implements OnInit {
  private readonly ordersService = inject(PharmacyOrdersService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  protected readonly orders = signal<PharmacyOrderView[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly activeFilter = signal<'pending' | 'processed'>('pending');
  protected readonly pharmacyOrders = computed(() => {
    const userId = this.authSession.currentUser()?.id;
    return this.orders().filter((order) => order.pharmacy.userId === userId);
  });
  protected readonly pendingCount = computed(
    () => this.pharmacyOrders().filter((order) => order.status === 'EN_ATTENTE_PHARMACIE').length,
  );
  protected readonly visibleOrders = computed(() =>
    this.pharmacyOrders().filter((order) =>
      this.activeFilter() === 'pending'
        ? order.status === 'EN_ATTENTE_PHARMACIE'
        : order.status !== 'EN_ATTENTE_PHARMACIE',
    ),
  );

  ngOnInit(): void {
    this.load();
  }

  protected openProviderSection(section: DoctorSpaceSection): void {
    void this.router.navigate(['/prestataire/espace'], { queryParams: { section } });
  }

  protected leaveProfessionalSpace(): void {
    void this.router.navigate(['/services']);
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.ordersService
      .list()
      .pipe(
        observeOn(asapScheduler),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (orders) => this.orders.set(orders),
        error: (error) =>
          this.errorMessage.set(
            getHttpErrorMessage(error, 'Impossible de charger les ordonnances reçues.'),
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

  protected statusLabel(status: string): string {
    return (
      (
        {
          EN_ATTENTE_PHARMACIE: 'À vérifier',
          EN_ATTENTE_PAIEMENT: 'Acceptée',
          PARTIELLEMENT_DISPONIBLE: 'Partielle',
          INDISPONIBLE: 'Indisponible',
          PAYEE_PHARMACIE: 'Payée',
          EN_ATTENTE_TRANSPORTEUR: 'Livraison à organiser',
          TRANSPORTEUR_ASSIGNE: 'Livreur assigné',
          EN_LIVRAISON: 'En livraison',
          LIVREE: 'Livrée',
        } as Record<string, string>
      )[status] ?? status
    );
  }
}
