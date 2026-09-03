import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import {
  MaterialOrdersService,
  MaterialOrderView,
} from '../../../data-access/material-orders.service';
import { MaterialOrdersRealtimeService } from '../../../data-access/material-orders-realtime.service';
import {
  DoctorSpaceSection,
  DoctorSpaceSidebarComponent,
} from '../../../../medicine/presentation/pages/doctor-space-page/components/doctor-space-sidebar/doctor-space-sidebar.component';

@Component({
  selector: 'app-material-orders-inbox-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, DoctorSpaceSidebarComponent],
  templateUrl: './material-orders-inbox-page.component.html',
  styleUrl: './material-orders-inbox-page.component.scss',
})
export class MaterialOrdersInboxPageComponent implements OnInit {
  private readonly ordersService = inject(MaterialOrdersService);
  private readonly realtime = inject(MaterialOrdersRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly orders = signal<MaterialOrderView[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.realtime.connect();
    this.realtime.orderChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(false));
    this.load(true);
  }

  protected openProviderSection(section: DoctorSpaceSection): void {
    void this.router.navigate(['/prestataire/espace'], { queryParams: { section } });
  }

  protected leaveProfessionalSpace(): void {
    void this.router.navigate(['/services']);
  }

  protected stayInHardwareSpace(): void {
    void this.router.navigate(['/material-orders']);
  }

  private load(showLoader: boolean): void {
    if (showLoader) this.loading.set(true);
    this.ordersService
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (orders) => this.orders.set(orders),
        error: () => this.error.set('Impossible de charger les demandes de materiel.'),
      });
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      EN_ATTENTE_QUINCAILLERIE: 'A verifier',
      EN_ATTENTE_PAIEMENT: 'Disponible - paiement attendu',
      PARTIELLEMENT_DISPONIBLE: 'Partiellement disponible',
      INDISPONIBLE: 'Indisponible',
      PAYEE_QUINCAILLERIE: 'Payee - retrait sur place',
      EN_ATTENTE_TRANSPORTEUR: 'Recherche d’un livreur',
      TRANSPORTEUR_ASSIGNE: 'Livreur assigne',
      LIVREE: 'Livree',
    };
    return labels[status] ?? status;
  }
}
