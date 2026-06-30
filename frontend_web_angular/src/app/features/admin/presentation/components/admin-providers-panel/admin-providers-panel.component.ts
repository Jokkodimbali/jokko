import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { userInitials } from '../../../../../shared/utils/user-initials';
import {
  AdminPaginatedResult,
  AdminProviderListQuery,
  AdminProviderProfile,
  AdminProviderStats,
} from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-providers-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-providers-panel.component.html',
  styleUrl: './admin-providers-panel.component.scss',
})
export class AdminProvidersPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) providers: AdminProviderProfile[] = [];
  @Input() isLoading = false;
  @Input() isActionLoading = false;
  @Input() pagination: AdminPaginatedResult<AdminProviderProfile>['pagination'] | null = null;
  @Input() stats: AdminProviderStats | null = null;
  @Input() selectedProviderId: string | null = null;
  @Input() selectedProviderDetail: AdminProviderProfile | null = null;

  @Output() queryChange = new EventEmitter<AdminProviderListQuery>();
  @Output() detailRequested = new EventEmitter<string>();
  @Output() detailClosed = new EventEmitter<void>();
  @Output() activationChange = new EventEmitter<{ providerId: string; active: boolean }>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly currentDetail = signal<AdminProviderProfile | null>(null);
  protected readonly selectedProvider = computed(
    () =>
      (this.currentDetail()?.id === this.selectedId() ? this.currentDetail() : null) ??
      this.providers.find((provider) => provider.id === this.selectedId()) ??
      null,
  );
  protected readonly detailProvider = computed(() =>
    this.currentDetail()?.id === this.selectedId() ? this.currentDetail() : null,
  );
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly activeFilter = signal('');
  protected readonly isDetailLoading = signal(false);
  private filterTimer: ReturnType<typeof setTimeout> | null = null;
  private detailTimer: ReturnType<typeof setTimeout> | null = null;
  protected verifiedCount(): number {
    return this.stats?.verifiedCount ?? this.providers.filter((provider) => provider.kycStatus === 'VERIFIE').length;
  }

  protected activeCount(): number {
    return this.stats?.activeCount ?? this.providers.filter((provider) => provider.active).length;
  }

  protected totalRevenue(): number {
    return this.stats?.revenueGross ?? this.providers.reduce((sum, provider) => sum + provider.revenueGross, 0);
  }

  protected totalReservations(): number {
    return this.stats?.reservationsCount ?? this.providers.reduce((sum, provider) => sum + provider.reservationsCount, 0);
  }

  ngOnChanges(): void {
    if (this.selectedProviderId !== this.selectedId()) {
      this.selectedId.set(this.selectedProviderId);
      if (this.selectedProviderId && this.selectedProviderDetail?.id !== this.selectedProviderId) {
        this.isDetailLoading.set(true);
      }
    }
    if (!this.providers.some((provider) => provider.id === this.selectedId())) {
      if (!this.selectedProviderId) {
        this.selectedId.set(null);
        this.currentDetail.set(null);
        this.isDetailLoading.set(false);
      }
    }
    if (this.selectedProviderDetail?.id === this.selectedId()) {
      this.currentDetail.set(this.selectedProviderDetail);
      this.isDetailLoading.set(false);
      if (this.detailTimer) clearTimeout(this.detailTimer);
    }
  }

  ngOnDestroy(): void {
    if (this.filterTimer) clearTimeout(this.filterTimer);
    if (this.detailTimer) clearTimeout(this.detailTimer);
  }

  protected select(providerId: string): void {
    this.selectedId.set(providerId);
    if (this.currentDetail()?.id !== providerId) {
      this.currentDetail.set(null);
    }
    this.isDetailLoading.set(true);
    if (this.detailTimer) clearTimeout(this.detailTimer);
    this.detailTimer = setTimeout(() => this.isDetailLoading.set(false), 5000);
    this.detailRequested.emit(providerId);
  }

  protected onSearchChange(value: string): void {
    this.search.set(value);
    this.scheduleFilters();
  }

  protected onFilterChange(kind: 'kyc' | 'active', value: string): void {
    if (kind === 'kyc') {
      this.statusFilter.set(value);
    } else {
      this.activeFilter.set(value);
    }
    this.applyFilters(1);
  }

  protected scheduleFilters(): void {
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.applyFilters(1), 300);
  }

  protected applyFilters(page = 1): void {
    this.queryChange.emit({
      search: this.search().trim() || undefined,
      kycStatus: this.statusFilter() || undefined,
      active: this.activeFilter() === '' ? undefined : this.activeFilter() === 'true',
      page,
      limit: this.pagination?.limit ?? 12,
    });
  }

  protected resetFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.activeFilter.set('');
    this.applyFilters(1);
  }

  protected backToList(): void {
    this.selectedId.set(null);
    this.currentDetail.set(null);
    this.isDetailLoading.set(false);
    this.detailClosed.emit();
  }

  protected goToPage(page: number): void {
    const maxPage = this.pagination?.totalPages ?? 1;
    if (page < 1 || page > maxPage) return;
    this.applyFilters(page);
  }

  protected toggleActivation(provider: AdminProviderProfile): void {
    this.activationChange.emit({ providerId: provider.id, active: !provider.active });
  }

  protected initials(name: string): string {
    return userInitials(name);
  }

  protected displayName(provider: AdminProviderProfile): string {
    return provider.companyName || provider.name;
  }

  protected kycLabel(status: string): string {
    const labels: Record<string, string> = {
      VERIFIE: 'Verifie',
      EN_ATTENTE: 'En validation',
      REJETE: 'Rejete',
    };
    return labels[status] ?? status;
  }

  protected formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  protected formatDate(date: string | Date | null): string {
    if (!date) return 'Aucune reservation';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }
}
