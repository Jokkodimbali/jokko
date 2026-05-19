import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import {
  AdminActivityItem,
  AdminCategoryMetric,
  AdminDashboard,
  AdminDashboardService,
  AdminKycProfile,
  AdminPlatformMetric,
  AdminSeriesPoint,
} from '../../../data-access/admin-dashboard.service';

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
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './admin-dashboard-page.component.html',
  styleUrl: './admin-dashboard-page.component.scss',
})
export class AdminDashboardPageComponent implements OnInit {
  protected readonly categoryColors = ['#d58a38', '#b95f34', '#86a361', '#9b8172', '#c96f48', '#6f8f77'];
  private readonly adminDashboardService = inject(AdminDashboardService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly kycProfiles = signal<AdminKycProfile[]>([]);
  protected readonly selectedKycId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isKycLoading = signal(false);
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
    { key: 'doctors', label: 'Medecins- Diplomes', icon: 'stethoscope', badge: () => this.dashboard()?.kyc.pending ?? 0 },
    { key: 'disputes', label: 'Litiges', icon: 'triangle-alert', badge: () => this.openDisputes() },
    { key: 'providers', label: 'Prestataires', icon: 'users', badge: () => this.providerCount() },
    { key: 'traffic', label: 'Trafic & Analytics', icon: 'chart-no-axes-combined', badge: () => this.trafficCount() },
    { key: 'revenue', label: 'Chiffre d affaire', icon: 'wallet-cards', badge: () => this.dashboard()?.revenue.monthlyGross ?? 0 },
    { key: 'regions', label: 'Regions Senegal', icon: 'globe-2', badge: () => this.dashboard()?.overview.categoryDistribution.length ?? 0 },
    { key: 'archives', label: 'Archives', icon: 'archive', badge: () => this.closedDisputes() },
    { key: 'structure', label: 'Structure des Services', icon: 'git-fork', badge: () => this.categoryTotal() },
  ];

  protected readonly selectedKyc = computed(() => {
    const profiles = this.kycProfiles();
    return profiles.find((profile) => profile.id === this.selectedKycId()) ?? profiles[0] ?? null;
  });

  ngOnInit(): void {
    if (this.authSession.getAuthenticatedRole() !== 'ADMIN') {
      this.router.navigate(['/services']);
      return;
    }

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
    if (section === 'validations' && this.kycProfiles().length === 0) {
      this.loadPendingKyc();
    }
  }

  protected loadPendingKyc(): void {
    this.isKycLoading.set(true);
    this.adminDashboardService
      .listPendingKyc()
      .pipe(
        catchError(() => {
          this.isKycLoading.set(false);
          return of([]);
        }),
      )
      .subscribe((profiles) => {
        this.kycProfiles.set(profiles);
        this.selectedKycId.set(profiles[0]?.id ?? null);
        this.isKycLoading.set(false);
      });
  }

  protected approveSelectedKyc(): void {
    const profile = this.selectedKyc();
    if (!profile) return;
    this.kycActionId.set(profile.id);
    this.adminDashboardService
      .approveKyc(profile.id)
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterKycMutation(updated));
  }

  protected rejectSelectedKyc(): void {
    const profile = this.selectedKyc();
    if (!profile) return;
    const reason = window.prompt('Motif du rejet du dossier KYC');
    if (!reason?.trim()) return;
    this.kycActionId.set(profile.id);
    this.adminDashboardService
      .rejectKyc(profile.id, reason.trim())
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
    this.selectedKycId.set(remaining[0]?.id ?? null);
    const dashboard = this.dashboard();
    if (!dashboard) return;
    this.dashboard.set({
      ...dashboard,
      kyc: {
        ...dashboard.kyc,
        pending: Math.max(0, dashboard.kyc.pending - 1),
      },
    });
  }

  protected kycTitle(profile: AdminKycProfile): string {
    return profile.nomEntreprise || profile.utilisateur.nom;
  }

  protected kycSubtitle(profile: AdminKycProfile): string {
    return profile.biographie || profile.ville || 'Profil professionnel';
  }

  protected kycInitials(profile: AdminKycProfile): string {
    const value = this.kycTitle(profile);
    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected kycDate(profile: AdminKycProfile): Date {
    return new Date(profile.creeLe);
  }

  protected formatKycDate(profile: AdminKycProfile): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(this.kycDate(profile));
  }

  protected kycDocuments(profile: AdminKycProfile): Array<{ label: string; url: string | null }> {
    return [
      { label: "Piece d'identite recto", url: profile.urlPieceIdentiteRecto },
      { label: "Piece d'identite verso", url: profile.urlPieceIdentiteVerso },
    ];
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

  protected formatCompact(value: number): string {
    if (value >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
    }
    if (value >= 1_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000)}K`;
    }
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  protected chartMax(series: AdminSeriesPoint[], keys: Array<'gross' | 'commission' | 'web' | 'ios' | 'android'>): number {
    return Math.max(1, ...series.flatMap((point) => keys.map((key) => Number(point[key] ?? 0))));
  }

  protected chartPointX(index: number, total: number): number {
    if (total <= 1) return 40;
    return 40 + (index * 500) / (total - 1);
  }

  protected chartPointY(
    value: number,
    series: AdminSeriesPoint[],
    keys: Array<'gross' | 'commission' | 'web' | 'ios' | 'android'>,
  ): number {
    return 150 - (Number(value || 0) / this.chartMax(series, keys)) * 112;
  }

  protected chartTicks(
    series: AdminSeriesPoint[],
    keys: Array<'gross' | 'commission' | 'web' | 'ios' | 'android'>,
  ): number[] {
    const max = this.chartMax(series, keys);
    return [max, max * 0.75, max * 0.5, max * 0.25, 0];
  }

  protected chartTickY(index: number): number {
    return 38 + index * 28;
  }

  protected linePoints(
    series: AdminSeriesPoint[],
    key: 'gross' | 'commission',
  ): string {
    return series
      .map((point, index) => {
        const x = this.chartPointX(index, series.length);
        const y = this.chartPointY(Number(point[key] ?? 0), series, ['gross', 'commission']);
        return `${x},${y}`;
      })
      .join(' ');
  }

  protected areaPoints(series: AdminSeriesPoint[], key: 'gross' | 'commission'): string {
    if (series.length === 0) return '';
    const line = this.linePoints(series, key);
    const start = this.chartPointX(0, series.length);
    const end = this.chartPointX(series.length - 1, series.length);
    return `${start},150 ${line} ${end},150`;
  }

  protected barHeight(
    value: number,
    series: AdminSeriesPoint[],
  ): number {
    return Math.max(2, (Number(value || 0) / this.chartMax(series, ['web', 'ios', 'android'])) * 118);
  }

  protected categoryOffset(categories: AdminCategoryMetric[], index: number): number {
    return categories.slice(0, index).reduce((sum, category) => sum + category.share, 0);
  }

  protected categoryColor(index: number): string {
    return this.categoryColors[index % this.categoryColors.length];
  }

  protected platformIcon(platform: AdminPlatformMetric): string {
    if (platform.key === 'ios') return 'apple';
    if (platform.key === 'android') return 'smartphone';
    return 'globe-2';
  }

  protected activityDate(activity: AdminActivityItem): Date {
    return new Date(activity.timestamp);
  }

}
