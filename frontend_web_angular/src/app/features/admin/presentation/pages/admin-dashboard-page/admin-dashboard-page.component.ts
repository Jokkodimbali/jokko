import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import {
  AdminArchivesReport,
  AdminDashboard,
  AdminDisputeCase,
  AdminKycProfile,
  AdminMedicalValidation,
  AdminPaginatedResult,
  AdminProviderListQuery,
  AdminProviderProfile,
  AdminProviderStats,
  AdminRegionsReport,
  AdminRevenuePeriod,
  AdminRevenueReport,
  AdminServiceStructureReport,
  AdminCategoryPayload,
  AdminSubCategoryPayload,
} from '../../../data-access/admin.models';
import { AdminDashboardService } from '../../../data-access/admin-dashboard.service';
import { AdminDisputesService } from '../../../data-access/admin-disputes.service';
import { AdminKycService } from '../../../data-access/admin-kyc.service';
import { AdminMedicalCredentialsService } from '../../../data-access/admin-medical-credentials.service';
import { AdminProvidersService } from '../../../data-access/admin-providers.service';
import { AdminArchivesPanelComponent } from '../../components/admin-archives-panel/admin-archives-panel.component';
import { AdminDisputesPanelComponent } from '../../components/admin-disputes-panel/admin-disputes-panel.component';
import { AdminMedicalCredentialsPanelComponent } from '../../components/admin-medical-credentials-panel/admin-medical-credentials-panel.component';
import { AdminKycValidationPanelComponent } from '../../components/admin-kyc-validation-panel/admin-kyc-validation-panel.component';
import { AdminOverviewPanelComponent } from '../../components/admin-overview-panel/admin-overview-panel.component';
import { AdminProvidersPanelComponent } from '../../components/admin-providers-panel/admin-providers-panel.component';
import { AdminRegionsPanelComponent } from '../../components/admin-regions-panel/admin-regions-panel.component';
import { AdminRevenuePanelComponent } from '../../components/admin-revenue-panel/admin-revenue-panel.component';
import { AdminServiceStructurePanelComponent } from '../../components/admin-service-structure-panel/admin-service-structure-panel.component';
import { AdminTrafficAnalyticsPanelComponent } from '../../components/admin-traffic-analytics-panel/admin-traffic-analytics-panel.component';
import { AdminUsersPanelComponent } from '../../components/admin-users-panel/admin-users-panel.component';
import { AdminReservationsPanelComponent } from '../../components/admin-reservations-panel/admin-reservations-panel.component';
import { AdminPaymentsPanelComponent } from '../../components/admin-payments-panel/admin-payments-panel.component';
import { AdminNotificationsPanelComponent } from '../../components/admin-notifications-panel/admin-notifications-panel.component';
import { userInitials } from '../../../../../shared/utils/user-initials';

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
  | 'structure'
  | 'users'
  | 'reservations'
  | 'payments'
  | 'notifications'
  | 'settings';

interface EditableAppBanner {
  id: string;
  imageUrl: string;
  redirectUrl: string | null;
  isActive: boolean;
  imageWidth: number | null;
  imageHeight: number | null;
}

const APP_BANNER_WIDTH = 936;
const APP_BANNER_HEIGHT = 220;
const APP_BANNER_RATIO = APP_BANNER_WIDTH / APP_BANNER_HEIGHT;
const APP_BANNER_MAX_FILE_SIZE = 2 * 1024 * 1024;
const APP_BANNER_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    AdminArchivesPanelComponent,
    AdminDisputesPanelComponent,
    AdminKycValidationPanelComponent,
    AdminMedicalCredentialsPanelComponent,
    AdminOverviewPanelComponent,
    AdminProvidersPanelComponent,
    AdminRegionsPanelComponent,
    AdminReservationsPanelComponent,
    AdminRevenuePanelComponent,
    AdminServiceStructurePanelComponent,
    AdminTrafficAnalyticsPanelComponent,
    AdminUsersPanelComponent,
    AdminPaymentsPanelComponent,
    AdminNotificationsPanelComponent,
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
  private readonly feedback = inject(AppFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly archivesReport = signal<AdminArchivesReport | null>(null);
  protected readonly disputeCases = signal<AdminDisputeCase[]>([]);
  protected readonly kycProfiles = signal<AdminKycProfile[]>([]);
  protected readonly medicalCredentialProfiles = signal<AdminMedicalValidation[]>([]);
  protected readonly providerProfiles = signal<AdminProviderProfile[]>([]);
  protected readonly selectedProviderDetail = signal<AdminProviderProfile | null>(null);
  protected readonly providerPagination = signal<
    AdminPaginatedResult<AdminProviderProfile>['pagination'] | null
  >(null);
  protected readonly providerStats = signal<AdminProviderStats | null>(null);
  protected readonly regionsReport = signal<AdminRegionsReport | null>(null);
  protected readonly revenueReport = signal<AdminRevenueReport | null>(null);
  protected readonly serviceStructureReport = signal<AdminServiceStructureReport | null>(null);
  protected readonly selectedProviderId = signal<string | null>(null);
  protected readonly providerQuery = signal<AdminProviderListQuery>({ page: 1, limit: 12 });
  protected readonly isLoading = signal(true);
  protected readonly isArchivesLoading = signal(false);
  protected readonly isDisputesLoading = signal(false);
  protected readonly isKycLoading = signal(false);
  protected readonly isMedicalLoading = signal(false);
  protected readonly isProvidersLoading = signal(false);
  protected readonly isRegionsLoading = signal(false);
  protected readonly isRevenueLoading = signal(false);
  protected readonly isStructureLoading = signal(false);
  protected readonly isProviderActionLoading = signal(false);
  protected readonly structureActionId = signal<string | null>(null);
  protected readonly kycActionId = signal<string | null>(null);
  protected readonly activeSection = signal<AdminSection>('overview');
  protected readonly appBanners = signal<EditableAppBanner[]>([]);
  protected readonly isAppBannersLoading = signal(false);
  protected readonly adminSearchQuery = signal('');
  protected readonly user = this.authSession.currentUser;
  protected readonly userInitials = computed(() => {
    const name = this.user()?.name ?? 'MD';
    return userInitials(name, 'MD');
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
    (this.dashboard()?.overview.platforms ?? []).reduce(
      (sum, platform) => sum + Number(platform.value ?? 0),
      0,
    ),
  );
  protected readonly categoryTotal = computed(() =>
    (this.dashboard()?.overview.categoryDistribution ?? []).reduce(
      (sum, item) => sum + item.value,
      0,
    ),
  );
  protected readonly navItems: Array<{
    key: AdminSection;
    label: string;
    icon: string;
    badge?: () => number;
  }> = [
    { key: 'overview', label: 'Vue d ensemble', icon: 'layout-dashboard' },
    {
      key: 'validations',
      label: 'Validations',
      icon: 'shield-check',
      badge: () => this.dashboard()?.kyc.pending ?? 0,
    },
    {
      key: 'doctors',
      label: 'Medecins- Diplomes',
      icon: 'stethoscope',
      badge: () => this.medicalCredentialProfiles().length,
    },
    { key: 'disputes', label: 'Litiges', icon: 'scale', badge: () => this.openDisputes() },
    { key: 'providers', label: 'Prestataires', icon: 'users', badge: () => this.providerCount() },
    {
      key: 'users',
      label: 'Utilisateurs',
      icon: 'user-round-cog',
      badge: () => this.dashboard()?.users.total ?? 0,
    },
    {
      key: 'reservations',
      label: 'Reservations',
      icon: 'calendar-days',
      badge: () => this.dashboard()?.reservations.active ?? 0,
    },
    {
      key: 'payments',
      label: 'Paiements',
      icon: 'banknote',
      badge: () => this.dashboard()?.reservations.inEscrow ?? 0,
    },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'settings', label: 'Parametres application', icon: 'sliders-horizontal' },
    {
      key: 'traffic',
      label: 'Trafic & Analytics',
      icon: 'chart-no-axes-combined',
      badge: () => this.trafficCount(),
    },
    {
      key: 'revenue',
      label: 'Chiffre d affaire',
      icon: 'wallet-cards',
      badge: () => this.dashboard()?.revenue.monthlyGross ?? 0,
    },
    {
      key: 'regions',
      label: 'Regions Senegal',
      icon: 'globe-2',
      badge: () => this.regionsReport()?.totals.regions ?? 0,
    },
    { key: 'archives', label: 'Archives', icon: 'archive', badge: () => this.closedDisputes() },
    {
      key: 'structure',
      label: 'Structure des Services',
      icon: 'git-fork',
      badge: () => this.serviceStructureReport()?.totals.categories ?? this.categoryTotal(),
    },
  ];

  ngOnInit(): void {
    if (this.authSession.getAuthenticatedRole() !== 'ADMIN') {
      this.router.navigate(['/services']);
      return;
    }

    this.restoreSectionFromUrl();

    this.loadAdminDashboard();
  }

  protected loadAdminDashboard(): void {
    this.isLoading.set(true);
    this.adminDashboardService
      .getDashboard()
      .pipe(
        catchError(() => {
          this.isLoading.set(false);
          this.feedback.error('Impossible de charger les donnees admin pour le moment.');
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
    this.adminSearchQuery.set('');
    if (section !== 'providers') {
      this.selectedProviderId.set(null);
      this.selectedProviderDetail.set(null);
    }
    this.updateAdminUrl({ section, providerId: null });
    this.loadSectionData(section);
  }

  protected updateAdminSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.adminSearchQuery.set(input.value);
  }

  protected clearAdminSearch(): void {
    this.adminSearchQuery.set('');
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
    if (section === 'revenue' && !this.revenueReport()) {
      this.loadRevenue();
    }
    if (section === 'regions' && !this.regionsReport()) {
      this.loadRegions();
    }
    if (section === 'archives' && !this.archivesReport()) {
      this.loadArchives();
    }
    if (section === 'structure' && !this.serviceStructureReport()) {
      this.loadServiceStructure();
    }
    if (section === 'settings' && this.appBanners().length === 0) this.loadAppBanners();
  }

  protected loadAppBanners(): void {
    this.isAppBannersLoading.set(true);
    this.adminDashboardService.getAppBanners().pipe(catchError(() => of([]))).subscribe((banners) => {
      this.appBanners.set(
        banners.map((banner) => ({ ...banner, imageWidth: null, imageHeight: null })),
      );
      this.isAppBannersLoading.set(false);
    });
  }

  protected addAppBanner(): void {
    if (this.appBanners().length >= 5) return;
    this.appBanners.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        imageUrl: '',
        redirectUrl: null,
        isActive: true,
        imageWidth: null,
        imageHeight: null,
      },
    ]);
  }

  protected removeAppBanner(index: number): void { this.appBanners.update((items) => items.filter((_, itemIndex) => itemIndex !== index)); }

  protected updateAppBanner(index: number, field: 'imageUrl' | 'redirectUrl', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.appBanners.update((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value || null } : item));
  }

  protected async uploadAppBannerImage(index: number, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!APP_BANNER_ALLOWED_TYPES.has(file.type)) {
      this.feedback.error('Utilisez une image JPG, PNG ou WebP pour la bannière.');
      input.value = '';
      return;
    }
    if (file.size > APP_BANNER_MAX_FILE_SIZE) {
      this.feedback.error('L image de bannière ne doit pas dépasser 2 Mo.');
      input.value = '';
      return;
    }

    const dimensions = await this.readImageDimensions(file).catch(() => null);
    if (!dimensions) {
      this.feedback.error('Impossible de lire les dimensions de cette image.');
      input.value = '';
      return;
    }

    this.setAppBannerDimensions(index, dimensions.width, dimensions.height);
    if (!this.hasRecommendedBannerFormat(dimensions.width, dimensions.height)) {
      this.feedback.info(
        `Image ${dimensions.width} × ${dimensions.height} px : utilisez 936 × 220 px pour éviter de couper du texte.`,
      );
    }

    this.isAppBannersLoading.set(true);
    this.adminDashboardService.uploadAppBannerImage(file).pipe(catchError(() => {
      this.feedback.error('Impossible d envoyer cette image.');
      return of(null);
    })).subscribe((result) => {
      this.isAppBannersLoading.set(false);
      input.value = '';
      if (!result) return;
      this.appBanners.update((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl: result.imageUrl } : item));
    });
  }

  protected recordAppBannerImageDimensions(index: number, event: Event): void {
    const image = event.target as HTMLImageElement;
    this.setAppBannerDimensions(index, image.naturalWidth, image.naturalHeight);
  }

  protected isAppBannerFormatConform(banner: EditableAppBanner): boolean {
    return this.hasRecommendedBannerFormat(banner.imageWidth, banner.imageHeight);
  }

  protected appBannerFormatMessage(banner: EditableAppBanner): string {
    const { imageWidth: width, imageHeight: height } = banner;
    if (!width || !height) return 'Format attendu : 936 × 220 px (ratio 4,25:1).';
    if (this.hasRecommendedBannerFormat(width, height)) {
      return 'Format conforme : 936 × 220 px.';
    }
    const ratioMatches = Math.abs(width / height - APP_BANNER_RATIO) / APP_BANNER_RATIO <= 0.005;
    if (ratioMatches) {
      return `Dimensions détectées : ${width} × ${height} px. Le ratio est correct, mais 936 × 220 px est recommandé.`;
    }
    return `Dimensions détectées : ${width} × ${height} px. Ratio non conforme : l image sera recadrée. Utilisez 936 × 220 px et gardez le texte important au centre.`;
  }

  protected saveAppBanners(): void {
    const banners = this.appBanners();
    if (banners.some((banner) => !banner.imageUrl)) { this.feedback.error('Chaque banniere doit avoir une image.'); return; }
    this.isAppBannersLoading.set(true);
    this.adminDashboardService.saveAppBanners(banners).pipe(catchError(() => { this.feedback.error('Impossible d enregistrer les bannieres.'); return of(null); })).subscribe((result) => {
      this.isAppBannersLoading.set(false);
      if (result !== null) this.feedback.success('Bannieres enregistrees.');
    });
  }

  private hasRecommendedBannerFormat(width: number | null, height: number | null): boolean {
    return width === APP_BANNER_WIDTH && height === APP_BANNER_HEIGHT;
  }

  private setAppBannerDimensions(index: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.appBanners.update((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, imageWidth: width, imageHeight: height } : item,
      ),
    );
  }

  private readImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image illisible'));
      };
      image.src = objectUrl;
    });
  }

  protected loadArchives(query = {}): void {
    this.isArchivesLoading.set(true);
    this.adminDashboardService
      .getArchives(query)
      .pipe(
        catchError(() => {
          this.isArchivesLoading.set(false);
          this.feedback.error('Impossible de charger les archives admin pour le moment.');
          return of(null);
        }),
      )
      .subscribe((report) => {
        this.archivesReport.set(report);
        this.isArchivesLoading.set(false);
      });
  }

  protected loadRegions(): void {
    this.isRegionsLoading.set(true);
    this.adminDashboardService
      .getRegions()
      .pipe(
        catchError(() => {
          this.isRegionsLoading.set(false);
          this.feedback.error('Impossible de charger les donnees regionales pour le moment.');
          return of(null);
        }),
      )
      .subscribe((report) => {
        this.regionsReport.set(report);
        this.isRegionsLoading.set(false);
      });
  }

  protected loadServiceStructure(): void {
    this.isStructureLoading.set(true);
    this.adminDashboardService
      .getServiceStructure()
      .pipe(
        catchError(() => {
          this.isStructureLoading.set(false);
          this.feedback.error('Impossible de charger la structure des services pour le moment.');
          return of(null);
        }),
      )
      .subscribe((report) => {
        this.serviceStructureReport.set(report);
        this.isStructureLoading.set(false);
      });
  }

  protected createCategory(payload: AdminCategoryPayload): void {
    this.structureActionId.set('create');
    this.adminDashboardService
      .createCategory(payload)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Categorie creee.'));
  }

  protected bulkCreateCategories(payload: AdminCategoryPayload[]): void {
    this.structureActionId.set('bulk-categories');
    this.adminDashboardService
      .bulkCreateCategories(payload)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Categories importees.'));
  }

  protected updateCategory(payload: { categoryId: string; payload: AdminCategoryPayload }): void {
    this.structureActionId.set(payload.categoryId);
    this.adminDashboardService
      .updateCategory(payload.categoryId, payload.payload)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Categorie mise a jour.'));
  }

  protected disableCategory(categoryId: string): void {
    this.structureActionId.set(categoryId);
    this.adminDashboardService
      .disableCategory(categoryId)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Categorie desactivee.'));
  }

  protected activateCategory(categoryId: string): void {
    this.structureActionId.set(categoryId);
    this.adminDashboardService
      .activateCategory(categoryId)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Categorie activee.'));
  }

  protected deleteEmptyCategory(categoryId: string): void {
    this.structureActionId.set(categoryId);
    this.adminDashboardService
      .deleteEmptyCategory(categoryId)
      .pipe(catchError(() => of(null)))
      .subscribe((result) =>
        this.afterCategoryMutation(!!result, 'Categorie supprimee definitivement.'),
      );
  }

  protected createSubCategory(payload: AdminSubCategoryPayload): void {
    this.structureActionId.set('subcategory');
    this.adminDashboardService
      .createSubCategory(payload)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Sous-categorie creee.'));
  }

  protected bulkCreateSubCategories(payload: AdminSubCategoryPayload[]): void {
    this.structureActionId.set('bulk-subcategories');
    this.adminDashboardService
      .bulkCreateSubCategories(payload)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Sous-categories importees.'));
  }

  protected assignSubCategories(payload: { categoryId: string; subCategoryIds: string[] }): void {
    this.structureActionId.set(payload.categoryId);
    this.adminDashboardService
      .assignSubCategories(payload.categoryId, payload.subCategoryIds)
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.afterCategoryMutation(!!result, 'Sous-categories affectees.'));
  }

  protected deleteUnusedSubCategory(subCategoryId: string): void {
    this.structureActionId.set(subCategoryId);
    this.adminDashboardService
      .deleteUnusedSubCategory(subCategoryId)
      .pipe(catchError(() => of(null)))
      .subscribe((result) =>
        this.afterCategoryMutation(!!result, 'Sous-categorie supprimee definitivement.'),
      );
  }

  private afterCategoryMutation(succeeded: boolean, successMessage: string): void {
    this.structureActionId.set(null);
    if (succeeded) {
      this.feedback.success(successMessage);
    } else {
      this.feedback.error('Action impossible sur la structure des services.');
    }
    this.loadServiceStructure();
    this.adminDashboardService
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard) this.dashboard.set(dashboard);
      });
  }

  protected loadRevenue(period: AdminRevenuePeriod = this.revenueReport()?.period ?? '12m'): void {
    this.isRevenueLoading.set(true);
    this.adminDashboardService
      .getRevenue(period)
      .pipe(
        catchError(() => {
          this.isRevenueLoading.set(false);
          this.feedback.error('Impossible de charger les indicateurs financiers pour le moment.');
          return of(null);
        }),
      )
      .subscribe((report) => {
        this.revenueReport.set(report);
        this.isRevenueLoading.set(false);
      });
  }

  protected loadDisputes(): void {
    this.isDisputesLoading.set(true);
    this.adminDisputesService
      .listOpen()
      .pipe(
        catchError(() => {
          this.isDisputesLoading.set(false);
          this.feedback.error('Impossible de charger les litiges admin pour le moment.');
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
      | 'reject'
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
          this.feedback.error('Impossible de traiter ce litige pour le moment.');
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
      | 'reject'
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
      return this.adminDisputesService.sendMessage(
        payload.disputeId,
        'CLIENT',
        payload.notes ?? '',
      );
    }
    if (payload.action === 'message-professional') {
      return this.adminDisputesService.sendMessage(
        payload.disputeId,
        'PRESTATAIRE',
        payload.notes ?? '',
      );
    }
    if (payload.action === 'message-both') {
      return this.adminDisputesService.sendMessage(payload.disputeId, 'TOUS', payload.notes ?? '');
    }
    if (payload.action === 'reject') {
      return this.adminDisputesService.reject(payload.disputeId, payload.notes ?? '');
    }
    return this.adminDisputesService.markInReview(payload.disputeId);
  }

  protected loadDisputeDetail(disputeId: string): void {
    this.adminDisputesService
      .get(disputeId)
      .pipe(catchError(() => of(null)))
      .subscribe((updated) => {
        if (!updated) return;
        this.disputeCases.set(
          this.disputeCases().map((dispute) => (dispute.id === updated.id ? updated : dispute)),
        );
      });
  }

  protected afterDisputeMutation(updated: AdminDisputeCase | unknown | null): void {
    this.kycActionId.set(null);
    if (updated && this.isAdminDisputeCase(updated)) {
      this.feedback.success('Litige mis a jour avec succes.');
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
          this.feedback.error('Impossible de charger les prestataires admin pour le moment.');
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
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de charger le detail de ce prestataire.');
          return of(null);
        }),
      )
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
    request
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de mettre a jour ce prestataire.');
          return of(null);
        }),
      )
      .subscribe((provider) => this.afterProviderMutation(provider));
  }

  private afterProviderMutation(provider: AdminProviderProfile | null): void {
    this.isProviderActionLoading.set(false);
    if (!provider) return;
    this.feedback.success('Statut du prestataire mis a jour.');
    const query = this.providerQuery();
    const remainsVisible = query.active === undefined || query.active === provider.active;
    const previousProvider = this.providerProfiles().find((item) => item.id === provider.id);

    if (previousProvider && previousProvider.active !== provider.active) {
      this.providerStats.update((stats) =>
        stats
          ? {
              ...stats,
              activeCount: Math.max(0, stats.activeCount + (provider.active ? 1 : -1)),
            }
          : stats,
      );
    }

    if (remainsVisible) {
      this.selectedProviderDetail.set(provider);
      this.providerProfiles.set(
        this.providerProfiles().map((item) =>
          item.id === provider.id ? { ...item, ...provider } : item,
        ),
      );
    } else {
      this.providerProfiles.set(this.providerProfiles().filter((item) => item.id !== provider.id));
      this.providerPagination.update((pagination) =>
        pagination
          ? {
              ...pagination,
              total: Math.max(0, pagination.total - 1),
            }
          : pagination,
      );
      this.closeProviderDetail();
    }

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
          this.feedback.error('Impossible de charger les dossiers KYC pour le moment.');
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
          this.feedback.error('Impossible d approuver ce dossier KYC.');
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterKycMutation(updated));
  }

  protected loadKycDetail(profileId: string): void {
    this.adminKycService
      .get(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((detail) => {
        if (!detail) return;
        this.kycProfiles.set(
          this.kycProfiles().map((profile) => (profile.id === detail.id ? detail : profile)),
        );
      });
  }

  protected rejectKyc(payload: { profileId: string; reason: string }): void {
    this.kycActionId.set(payload.profileId);
    this.adminKycService
      .reject(payload.profileId, payload.reason)
      .pipe(
        catchError(() => {
          this.kycActionId.set(null);
          this.feedback.error('Impossible de rejeter ce dossier KYC.');
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterKycMutation(updated));
  }

  protected afterKycMutation(updated: AdminKycProfile | null): void {
    this.kycActionId.set(null);
    if (!updated) return;
    this.feedback.success('Dossier KYC traite avec succes.');
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
          this.feedback.error('Impossible de charger les diplomes medecins pour le moment.');
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
          this.feedback.error('Impossible de certifier ce medecin.');
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
          this.feedback.error('Impossible de rejeter ce diplome medecin.');
          return of(null);
        }),
      )
      .subscribe((updated) => this.afterMedicalMutation(updated?.professionalId ?? null));
  }

  protected afterMedicalMutation(profileId: string | null): void {
    this.kycActionId.set(null);
    if (!profileId) return;
    this.feedback.success('Dossier medecin traite avec succes.');
    const dashboard = this.dashboard();
    const remaining = this.medicalCredentialProfiles().filter(
      (profile) => profile.id !== profileId,
    );
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
