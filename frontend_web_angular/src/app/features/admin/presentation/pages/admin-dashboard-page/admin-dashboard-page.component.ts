import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import {
  AdminDashboard,
  AdminDisputeCase,
  AdminKycProfile,
  AdminMedicalValidation,
  AdminPaginatedResult,
  AdminProviderListQuery,
  AdminProviderProfile,
  AdminProviderStats,
} from '../../../data-access/admin.models';
import { AdminDashboardService } from '../../../data-access/admin-dashboard.service';
import { AdminDisputesService } from '../../../data-access/admin-disputes.service';
import { AdminKycService } from '../../../data-access/admin-kyc.service';
import { AdminMedicalCredentialsService } from '../../../data-access/admin-medical-credentials.service';
import { AdminProvidersService } from '../../../data-access/admin-providers.service';
import { AdminDisputesPanelComponent } from '../../components/admin-disputes-panel/admin-disputes-panel.component';
import { AdminMedicalCredentialsPanelComponent } from '../../components/admin-medical-credentials-panel/admin-medical-credentials-panel.component';
import { AdminKycValidationPanelComponent } from '../../components/admin-kyc-validation-panel/admin-kyc-validation-panel.component';
import { AdminOverviewPanelComponent } from '../../components/admin-overview-panel/admin-overview-panel.component';
import { AdminProvidersPanelComponent } from '../../components/admin-providers-panel/admin-providers-panel.component';

type AdminSection =
  | 'overview'
  | 'validations'
  | 'doctors'
  | 'disputes'
  | 'providers'
  | 'traffic'
  | 'revenue'
  | 'regions'
  | 'archives'
  | 'structure';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    AdminDisputesPanelComponent,
    AdminKycValidationPanelComponent,
    AdminMedicalCredentialsPanelComponent,
    AdminOverviewPanelComponent,
    AdminProvidersPanelComponent,
  ],
  templateUrl: './admin-dashboard-page.component.html',
  styleUrl: './admin-dashboard-page.component.scss',
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly adminDisputesService = inject(AdminDisputesService);
  private readonly adminKycService = inject(AdminKycService);
  private readonly adminMedicalCredentialsService = inject(AdminMedicalCredentialsService);
  private readonly adminProvidersService = inject(AdminProvidersService);
  private readonly authSession = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly disputeCases = signal<AdminDisputeCase[]>([]);
  protected readonly kycProfiles = signal<AdminKycProfile[]>([]);
  protected readonly medicalCredentialProfiles = signal<AdminMedicalValidation[]>([]);
  protected readonly providerProfiles = signal<AdminProviderProfile[]>([]);
  protected readonly selectedProviderDetail = signal<AdminProviderProfile | null>(null);
  protected readonly providerPagination = signal<AdminPaginatedResult<AdminProviderProfile>['pagination'] | null>(null);
  protected readonly providerStats = signal<AdminProviderStats | null>(null);
  protected readonly selectedProviderId = signal<string | null>(null);
  protected readonly providerQuery = signal<AdminProviderListQuery>({ page: 1, limit: 12 });
  protected readonly isLoading = signal(true);
  protected readonly isDisputesLoading = signal(false);
  protected readonly isKycLoading = signal(false);
  protected readonly isMedicalLoading = signal(false);
  protected readonly isProvidersLoading = signal(false);
  protected readonly isProviderActionLoading = signal(false);
  protected readonly kycActionId = signal<string | null>(null);
  protected readonly activeSection = signal<AdminSection>('overview');
  protected readonly user = this.authSession.currentUser;
  protected readonly userInitials = computed(() => {
    const name = this.user()?.name ?? 'MD';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });

  protected readonly openDisputes = computed(() => {
    const disputes = this.dashboard()?.disputes;
    return disputes ? disputes.open + disputes.inReview : 0;
  });
  protected readonly closedDisputes = computed(() => {
    const disputes = this.dashboard()?.disputes;
    return disputes ? disputes.resolved + disputes.rejected : 0;
  });
  protected readonly providerCount = computed(() => {
    const kpi = this.dashboard()?.overview.kpis.find((item) => item.key === 'providers');
    return kpi?.value ?? 0;
  });
  protected readonly trafficCount = computed(() =>
    (this.dashboard()?.overview.trafficSeries ?? []).reduce(
      (sum, point) => sum + Number(point.web ?? 0) + Number(point.ios ?? 0) + Number(point.android ?? 0),
      0,
    ),
  );
  protected readonly categoryTotal = computed(() =>
    (this.dashboard()?.overview.categoryDistribution ?? []).reduce((sum, item) => sum + item.value, 0),
  );
  protected readonly navItems: Array<{
    key: AdminSection;
    label: string;
    icon: string;
    badge?: () => number;
  }> = [
    { key: 'overview', label: 'Vue d ensemble', icon: 'layout-dashboard' },
    { key: 'validations', label: 'Validations', icon: 'shield-check', badge: () => this.dashboard()?.kyc.pending ?? 0 },
    { key: 'doctors', label: 'Medecins- Diplomes', icon: 'stethoscope', badge: () => this.medicalCredentialProfiles().length },
    { key: 'disputes', label: 'Litiges', icon: 'scale', badge: () => this.openDisputes() },
    { key: 'providers', label: 'Prestataires', icon: 'users', badge: () => this.providerCount() },
    { key: 'traffic', label: 'Trafic & Analytics', icon: 'chart-no-axes-combined', badge: () => this.trafficCount() },
    { key: 'revenue', label: 'Chiffre d affaire', icon: 'wallet-cards', badge: () => this.dashboard()?.revenue.monthlyGross ?? 0 },
    { key: 'regions', label: 'Regions Senegal', icon: 'globe-2', badge: () => this.dashboard()?.overview.categoryDistribution.length ?? 0 },
    { key: 'archives', label: 'Archives', icon: 'archive', badge: () => this.closedDisputes() },
    { key: 'structure', label: 'Structure des Services', icon: 'git-fork', badge: () => this.categoryTotal() },
  ];

  ngOnInit(): void {
    if (this.authSession.getAuthenticatedRole() !== 'ADMIN') {
      this.router.navigate(['/services']);
      return;
    }

    this.restoreSectionFromUrl();

    this.adminDashboardService
      .getDashboard()
      .pipe(
        catchError(() => {
          this.isLoading.set(false);
          return of(null);
        }),
      )
      .subscribe((dashboard) => {
        this.dashboard.set(dashboard);
        this.isLoading.set(false);
      });
  }

  protected selectSection(section: AdminSection): void {
    this.activeSection.set(section);
    if (section !== 'providers') {
      this.selectedProviderId.set(null);
      this.selectedProviderDetail.set(null);
    }
    this.updateAdminUrl({ section, providerId: null });
    this.loadSectionData(section);
  }

  private loadSectionData(section: AdminSection): void {
    if (section === 'validations' && this.kycProfiles().length === 0) {
      this.loadPendingKyc();
    }
    if (section === 'doctors' && this.medicalCredentialProfiles().length === 0) {
      this.loadMedicalCredentials();
    }
    if (section === 'disputes' && this.disputeCases().length === 0) {
      this.loadDisputes();
    }
    if (section === 'providers' && this.providerProfiles().length === 0) {
      this.loadProviders();
    }
  }

  protected loadDisputes(): void {
    this.isDisputesLoading.set(true);
    this.adminDisputesService
      .listOpen()
      .pipe(
        catchError(() => {
          this.isDisputesLoading.set(false);
          return of([]);
        }),
      )
      .subscribe((disputes) => {
        this.disputeCases.set(disputes);
        this.isDisputesLoading.set(false);
      });
  }

  protected handleDisputeAction(payload: {
    disputeId: string;
    action:
      | 'review'
      | 'refund-client'
      | 'credit-professional'
      | 'message-client'
      | 'message-professional'
      | 'message-both';
    notes?: string;
    clientRefundPercentage?: number;
  }): void {
    this.kycActionId.set(payload.disputeId);
    const request = this.buildDisputeActionRequest(payload);

    request
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterDisputeMutation(updated));
  }

  private buildDisputeActionRequest(payload: {
    disputeId: string;
    action:
      | 'review'
      | 'refund-client'
      | 'credit-professional'
      | 'message-client'
      | 'message-professional'
      | 'message-both';
    notes?: string;
    clientRefundPercentage?: number;
  }) {
    if (payload.action === 'refund-client') {
      return this.adminDisputesService.refundClient(
        payload.disputeId,
        payload.notes ?? '',
        payload.clientRefundPercentage,
      );
    }
    if (payload.action === 'credit-professional') {
      return this.adminDisputesService.creditProfessional(
        payload.disputeId,
        payload.notes ?? '',
        payload.clientRefundPercentage,
      );
    }
    if (payload.action === 'message-client') {
      return this.adminDisputesService.sendMessage(payload.disputeId, 'CLIENT', payload.notes ?? '');
    }
    if (payload.action === 'message-professional') {
      return this.adminDisputesService.sendMessage(payload.disputeId, 'PRESTATAIRE', payload.notes ?? '');
    }
    if (payload.action === 'message-both') {
      return this.adminDisputesService.sendMessage(payload.disputeId, 'TOUS', payload.notes ?? '');
    }
    return this.adminDisputesService.markInReview(payload.disputeId);
  }

  protected afterDisputeMutation(updated: AdminDisputeCase | unknown | null): void {
    this.kycActionId.set(null);
    if (updated && this.isAdminDisputeCase(updated)) {
      this.disputeCases.set(
        this.disputeCases().map((dispute) => (dispute.id === updated.id ? updated : dispute)),
      );
    }
    this.loadDisputes();
    this.adminDashboardService
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard) this.dashboard.set(dashboard);
      });
  }

  protected loadProviders(query: AdminProviderListQuery = this.providerQuery()): void {
    this.providerQuery.set({ ...this.providerQuery(), ...query });
    this.isProvidersLoading.set(true);
    this.adminProvidersService
      .list(this.providerQuery())
      .pipe(
        catchError(() => {
          this.isProvidersLoading.set(false);
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (!result) return;
        this.providerProfiles.set(result.items);
        this.providerPagination.set(result.pagination);
        this.providerStats.set(result.stats ?? null);
        this.isProvidersLoading.set(false);
        const providerId = this.selectedProviderId();
        if (providerId && !this.selectedProviderDetail()) {
          this.loadProviderDetail(providerId);
        }
      });
  }

  protected loadProviderDetail(providerId: string): void {
    this.selectedProviderId.set(providerId);
    this.updateAdminUrl({ section: 'providers', providerId });
    this.adminProvidersService
      .get(providerId)
      .pipe(catchError(() => of(null)))
      .subscribe((provider) => this.selectedProviderDetail.set(provider));
  }

  protected closeProviderDetail(): void {
    this.selectedProviderId.set(null);
    this.selectedProviderDetail.set(null);
    this.updateAdminUrl({ section: 'providers', providerId: null });
  }

  protected handleProviderActivation(payload: { providerId: string; active: boolean }): void {
    this.isProviderActionLoading.set(true);
    const request = payload.active
      ? this.adminProvidersService.activate(payload.providerId)
      : this.adminProvidersService.deactivate(payload.providerId);
    request.pipe(catchError(() => of(null))).subscribe((provider) => this.afterProviderMutation(provider));
  }

  private afterProviderMutation(provider: AdminProviderProfile | null): void {
    this.isProviderActionLoading.set(false);
    if (!provider) return;
    this.selectedProviderDetail.set(provider);
    this.providerProfiles.set(
      this.providerProfiles().map((item) => (item.id === provider.id ? { ...item, ...provider } : item)),
    );
    this.adminDashboardService
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard) this.dashboard.set(dashboard);
      });
  }

  private isAdminDisputeCase(value: unknown): value is AdminDisputeCase {
    return typeof value === 'object' && value !== null && 'reservationId' in value;
  }

  private restoreSectionFromUrl(): void {
    const sectionParam = this.route.snapshot.queryParamMap.get('section');
    const section = this.isAdminSection(sectionParam) ? sectionParam : 'overview';
    const providerId = this.route.snapshot.queryParamMap.get('providerId');
    this.activeSection.set(section);

    if (section === 'providers') {
      this.selectedProviderId.set(providerId);
      this.loadProviders();
      if (providerId) {
        this.loadProviderDetail(providerId);
      }
      return;
    }

    this.loadSectionData(section);
  }

  private updateAdminUrl(params: { section: AdminSection; providerId?: string | null }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        section: params.section === 'overview' ? null : params.section,
        providerId: params.providerId ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private isAdminSection(value: string | null): value is AdminSection {
    return this.navItems.some((item) => item.key === value);
  }

  protected loadPendingKyc(): void {
    this.isKycLoading.set(true);
    this.adminKycService
      .listPending()
      .pipe(
        catchError(() => {
          this.isKycLoading.set(false);
          return of([]);
        }),
      )
      .subscribe((profiles) => {
        this.kycProfiles.set(profiles);
        this.isKycLoading.set(false);
      });
  }

  protected approveKyc(profileId: string): void {
    this.kycActionId.set(profileId);
    this.adminKycService
      .approve(profileId)
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterKycMutation(updated));
  }

  protected rejectKyc(payload: { profileId: string; reason: string }): void {
    this.kycActionId.set(payload.profileId);
    this.adminKycService
      .reject(payload.profileId, payload.reason)
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterKycMutation(updated));
  }

  protected afterKycMutation(updated: AdminKycProfile | null): void {
    this.kycActionId.set(null);
    if (!updated) return;
    const remaining = this.kycProfiles().filter((profile) => profile.id !== updated.id);
    this.kycProfiles.set(remaining);
    const dashboard = this.dashboard();
    if (!dashboard) return;
    this.dashboard.set({
      ...dashboard,
      kyc: {
        ...dashboard.kyc,
        pending: Math.max(0, dashboard.kyc.pending - 1),
      },
      overview: {
        ...dashboard.overview,
      },
    });
  }

  protected loadMedicalCredentials(): void {
    this.isMedicalLoading.set(true);
    this.adminMedicalCredentialsService
      .listPending()
      .pipe(
        catchError(() => {
          this.isMedicalLoading.set(false);
          return of([]);
        }),
      )
      .subscribe((profiles) => {
        this.medicalCredentialProfiles.set(profiles);
        this.isMedicalLoading.set(false);
      });
  }

  protected certifyMedical(profileId: string): void {
    this.kycActionId.set(profileId);
    this.adminMedicalCredentialsService
      .certify(profileId)
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterMedicalMutation(updated?.professionalId ?? null));
  }

  protected rejectMedical(payload: { profileId: string; reason: string }): void {
    this.kycActionId.set(payload.profileId);
    this.adminMedicalCredentialsService
      .reject(payload.profileId, payload.reason)
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterMedicalMutation(updated?.professionalId ?? null));
  }

  protected afterMedicalMutation(profileId: string | null): void {
    this.kycActionId.set(null);
    if (!profileId) return;
    const dashboard = this.dashboard();
    const remaining = this.medicalCredentialProfiles().filter((profile) => profile.id !== profileId);
    this.medicalCredentialProfiles.set(remaining);
    if (!dashboard) return;
    this.dashboard.set({
      ...dashboard,
      kyc: {
        ...dashboard.kyc,
        pending: Math.max(0, dashboard.kyc.pending - 1),
      },
    });
    this.kycProfiles.set(this.kycProfiles().filter((profile) => profile.id !== profileId));
  }

  protected formatMetric(value: number, unit?: string): string {
    if (unit === 'FCFA') {
      if (value >= 1_000_000) {
        return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`;
      }
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
    }

    if (value >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} Millions`;
    }

    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  protected formatBadge(value: number): string {
    if (value >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
    }
    if (value >= 1_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000)}K`;
    }
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }
}
