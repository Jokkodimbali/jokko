import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import {
  FavoriteItem,
  FavoriteStatus,
  FavoritesService,
} from '../../../../../core/favorites/favorites.service';
import { ServicesService } from '../../../data-access/services.service';
import {
  CategoryStructure,
  ServiceSection,
  PaginationMeta,
  Professional,
  ServiceSubCategory,
} from '../../../domain/models/services.models';
import { SERVICES_UI_MESSAGES } from '../../../domain/services-ui.messages';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { AppSearchBarComponent } from '../../../../../shared/ui/app-search-bar/app-search-bar.component';

type ProfessionalFilter = 'ALL' | 'MEDECIN' | 'PRESTATAIRE';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppFooterComponent,
    AppNavbarComponent,
    AppScrollHintComponent,
    AppSearchBarComponent,
    LucideAngularModule,
  ],
  templateUrl: './services.component.html',
  styleUrls: [
    './services.component.scss',
    './services-hero.component.scss',
    './services-feed.component.scss',
    './services-responsive.component.scss',
  ],
})
export class ServicesComponent implements OnInit, OnDestroy {
  private readonly servicesService = inject(ServicesService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);

  protected readonly heroIllustration = '/image%20haut.png';

  sections = signal<ServiceSection[]>([]);
  categoryPagination = signal<PaginationMeta | undefined>(undefined);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  searchTerm = signal<string>('');
  activeFilter = signal<ProfessionalFilter>('ALL');
  activeCategoryId = signal<string | null>(null);
  activeSubCategoryId = signal<string | null>(null);
  categories = signal<CategoryStructure[]>([]);
  failedImageUrls = signal<Set<string>>(new Set());
  readonly locationValue = 'Toute zone';
  protected readonly filters: Array<{ value: ProfessionalFilter; label: string; countLabel: string }> = [
    { value: 'ALL', label: 'Tous', countLabel: 'profils disponibles' },
    { value: 'MEDECIN', label: 'Medecins', countLabel: 'medecins disponibles' },
    { value: 'PRESTATAIRE', label: 'Prestataires', countLabel: 'prestataires disponibles' },
  ];
  protected readonly typeFilters = this.filters.filter((filter) => filter.value !== 'ALL');
  favoriteProviders = computed(() =>
    this.favoritesService.favorites().map((favorite) => ({
      id: favorite.professionalId,
      nom: favorite.name,
      speciality: favorite.subtitle,
      location: favorite.location,
      status: favorite.totalReviews > 0
        ? `${favorite.rating}/5 (${favorite.totalReviews} avis)`
        : 'Favori',
      rating: favorite.rating,
      totalReviews: favorite.totalReviews,
      isOnline: favorite.isOnline,
      onlineLabel: favorite.isOnline ? 'En ligne' : 'Favori',
      avatar: favorite.avatarUrl || undefined,
      photos: favorite.portfolioImages.map((image) => image.url).filter(Boolean),
      route: `/services/${favorite.professionalId}`,
    })),
  );
  protected readonly activeFilterLabel = computed(() => {
    const activeSubCategory = this.activeSubCategory();
    if (activeSubCategory) {
      return activeSubCategory.nom;
    }

    const activeCategory = this.categories().find((category) => category.id === this.activeCategoryId());
    if (activeCategory) {
      return activeCategory.nom;
    }

    if (this.activeFilter() === 'MEDECIN') {
      return 'Medecins';
    }

    if (this.activeFilter() === 'PRESTATAIRE') {
      return 'Prestataires';
    }

    return 'Toutes categories';
  });
  protected readonly activeSubCategories = computed(() => {
    const activeCategory = this.categories().find((category) => category.id === this.activeCategoryId());
    return this.visibleSubCategories(activeCategory?.subCategories ?? []);
  });
  protected readonly isSearchOrFilterActive = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.activeFilter() !== 'ALL' ||
      this.activeCategoryId() !== null ||
      this.activeSubCategoryId() !== null,
  );
  protected readonly activeSubCategory = computed(() => {
    const subCategoryId = this.activeSubCategoryId();
    if (!subCategoryId) {
      return null;
    }

    for (const category of this.categories()) {
      const found = this.visibleSubCategories(category.subCategories).find(
        (subCategory) => subCategory.id === subCategoryId,
      );
      if (found) {
        return found;
      }
    }

    return null;
  });
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private requestVersion = 0;

  ngOnInit(): void {
    this.loadCategories();
    this.loadFavorites();
    this.loadHomeData();
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
  }

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
    this.clearSearchDebounce();
    this.searchDebounce = setTimeout(() => {
      this.loadProfessionals(1);
    }, 280);
  }

  submitSearch(value: string): void {
    this.searchTerm.set(value.trim());
    this.clearSearchDebounce();
    this.loadProfessionals(1);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.clearSearchDebounce();
    this.loadProfessionals(1);
  }

  selectFilter(filter: ProfessionalFilter): void {
    if (this.activeFilter() === filter) {
      if (filter !== 'ALL') {
        this.activeFilter.set('ALL');
        this.activeCategoryId.set(null);
        this.activeSubCategoryId.set(null);
        this.loadProfessionals(1);
      }
      return;
    }

    this.activeFilter.set(filter);
    this.activeCategoryId.set(null);
    this.activeSubCategoryId.set(null);
    this.loadProfessionals(1);
  }

  selectCategory(categoryId: string | null): void {
    if (this.activeFilter() === 'ALL' && this.activeCategoryId() === categoryId && this.activeSubCategoryId() === null) {
      return;
    }

    this.activeFilter.set('ALL');
    this.activeCategoryId.set(categoryId);
    this.activeSubCategoryId.set(null);
    this.loadProfessionals(1);
  }

  selectSubCategory(categoryId: string, subCategoryId: string): void {
    if (
      this.activeFilter() === 'ALL' &&
      this.activeCategoryId() === categoryId &&
      this.activeSubCategoryId() === subCategoryId
    ) {
      return;
    }

    this.activeFilter.set('ALL');
    this.activeCategoryId.set(categoryId);
    this.activeSubCategoryId.set(subCategoryId);
    this.loadProfessionals(1);
  }

  cycleFilter(): void {
    const filtersElement = document.getElementById('services-filters');
    filtersElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  onViewAll(section: ServiceSection): void {
    const nextPage = (section.pagination?.page || 1) + 1;
    if (section.pagination && nextPage > section.pagination.totalPages) {
      return;
    }

    this.loadProfessionals(nextPage, section);
  }

  loadHomeData(page: number = 1): void {
    if (page === 1) {
      this.searchTerm.set('');
    }

    this.loadProfessionals(page);
  }

  loadMoreCategories(): void {
    const section = this.sections()[0];
    if (!section) {
      return;
    }

    this.onViewAll(section);
  }

  private loadProfessionals(page: number = 1, appendToSection?: ServiceSection): void {
    const query = this.searchTerm().trim();
    const requestId = ++this.requestVersion;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.fetchProfessionals(query, page).subscribe({
      next: (result) => {
        if (requestId !== this.requestVersion) {
          return;
        }

        const section = this.buildSection(result, query);
        if (appendToSection || page > 1) {
          this.sections.update((sections) =>
            sections.map((current) =>
              current.id === (appendToSection?.id ?? section.id)
                ? {
                    ...current,
                    providers: [...current.providers, ...section.providers],
                    pagination: section.pagination,
                    countLabel: section.countLabel,
                  }
                : current,
            ),
          );
        } else {
          this.sections.set([section]);
        }
        this.categoryPagination.set(result.meta);
        this.isLoading.set(false);
      },
      error: () => {
        if (requestId !== this.requestVersion) {
          return;
        }

        const message = page > 1
          ? SERVICES_UI_MESSAGES.loadMoreProfessionalsFailed
          : SERVICES_UI_MESSAGES.loadServicesFailed;
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoading.set(false);
      },
    });
  }

  private fetchProfessionals(
    query: string,
    page: number,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    const filter = this.activeFilter();
    const categoryId = this.activeCategoryId() ?? undefined;
    const subCategoryId = this.activeSubCategoryId() ?? undefined;

    if (filter === 'ALL') {
      return this.servicesService.searchUnifiedProfessionals(query, page, 24, undefined, categoryId, subCategoryId);
    }

    return this.servicesService.searchProfessionalsByRole(filter, query, page, 24, undefined, categoryId, subCategoryId);
  }

  private buildSection(
    result: { providers: Professional[]; meta?: PaginationMeta },
    query: string,
  ): ServiceSection {
    const activeFilter = this.filters.find((filter) => filter.value === this.activeFilter()) ?? this.filters[0];
    const activeCategory = this.categories().find((category) => category.id === this.activeCategoryId());
    const activeSubCategory = this.activeSubCategory();
    const total = result.meta?.total || result.providers.length;
    const title = query
      ? `Recherche ${query}`
      : activeSubCategory
        ? activeSubCategory.nom
        : activeCategory
        ? activeCategory.nom
        : this.activeFilter() === 'ALL'
          ? 'Tous les prestataires'
          : activeFilter.label;

    return {
      id: `providers-${this.activeFilter().toLowerCase()}-${this.activeCategoryId() ?? 'all'}-${this.activeSubCategoryId() ?? 'all'}`,
      title,
      countLabel: `${total} ${activeCategory || activeSubCategory ? 'profils disponibles' : activeFilter.countLabel}`,
      providers: result.providers,
      pagination: result.meta,
    };
  }

  private loadCategories(): void {
    this.servicesService.getCategoryStructure().subscribe({
      next: (categories) => {
        this.categories.set(
          categories
            .filter((category) => category.estActive !== false)
            .map((category) => ({
              ...category,
              subCategories: this.visibleSubCategories(category.subCategories),
            }))
            .sort((a, b) => a.ordreTri - b.ordreTri || a.nom.localeCompare(b.nom)),
        );
      },
      error: () => {
        this.categories.set([]);
      },
    });
  }

  private visibleSubCategories(subCategories: ServiceSubCategory[]): ServiceSubCategory[] {
    const seen = new Set<string>();
    return subCategories
      .filter((subCategory) => subCategory.estActive !== false)
      .filter((subCategory) => {
        if (seen.has(subCategory.id)) {
          return false;
        }
        seen.add(subCategory.id);
        return true;
      })
      .sort((a, b) => a.ordreTri - b.ordreTri || a.nom.localeCompare(b.nom));
  }

  private loadFavorites(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.favoritesService.list().subscribe({
      error: () => {
        this.feedback.error('Impossible de charger vos favoris pour le moment.');
      },
    });
  }

  private clearSearchDebounce(): void {
    if (!this.searchDebounce) {
      return;
    }

    clearTimeout(this.searchDebounce);
    this.searchDebounce = null;
  }

  resolveProviderAvatar(provider: { avatar?: string }): string | null {
    return this.visibleImageUrl(provider.avatar);
  }

  visibleImageUrl(url: string | null | undefined): string | null {
    const value = url?.trim();
    if (!value || this.failedImageUrls().has(value)) {
      return null;
    }

    return value;
  }

  handleImageError(url: string | null | undefined): void {
    const value = url?.trim();
    if (!value) {
      return;
    }

    this.failedImageUrls.update((urls) => {
      const next = new Set(urls);
      next.add(value);
      return next;
    });
  }

  providerInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  providerPhotos(provider: { photos: string[] }): string[] {
    return provider.photos
      .map((photo) => photo.trim())
      .filter((photo) => photo.length > 0 && !this.failedImageUrls().has(photo))
      .slice(0, 6);
  }

  providerRatingLabel(provider: { rating: number; totalReviews: number }): string {
    if (provider.totalReviews <= 0) {
      return 'Nouveau';
    }

    return `${provider.rating.toFixed(1)} (${provider.totalReviews} avis)`;
  }

  providerMovementTitle(provider: Professional): string {
    if (provider.profileType === 'MEDECIN') {
      return 'Le client se deplace';
    }

    switch (provider.serviceTravelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'Le client se deplace';
      case 'TRANSPORT_COLIS':
        return 'Transport de colis';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'Se deplace chez vous';
    }
  }

  providerMovementIcon(provider: Professional): string {
    if (provider.profileType === 'MEDECIN') {
      return 'map-pin';
    }

    switch (provider.serviceTravelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'map-pin';
      case 'TRANSPORT_COLIS':
        return 'clipboard';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'wrench';
    }
  }

  providerMovementSubtitle(provider: Professional): string {
    if (provider.profileType === 'MEDECIN') {
      return 'Rendez-vous au cabinet ou au point de consultation';
    }

    switch (provider.serviceTravelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'Rendez-vous chez le prestataire';
      case 'TRANSPORT_COLIS':
        return 'Colis pris en charge du point A au point B';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'Intervention a votre domicile';
    }
  }

  providerProfileCommands(provider: Professional): unknown[] {
    return ['/services', provider.id];
  }

  providerActionLabel(provider: Professional): string {
    return provider.profileType === 'MEDECIN' ? 'Prendre rendez-vous' : 'Negocier le prix';
  }

  providerPrimaryAction(provider: Professional): void {
    if (provider.profileType === 'MEDECIN') {
      this.router.navigate(['/medecine', provider.id, 'rendez-vous'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.openNegotiation(provider);
  }

  isProviderFavorite(providerId: string): boolean {
    return this.favoritesService
      .favorites()
      .some((favorite) => favorite.professionalId === providerId);
  }

  toggleProviderFavorite(event: Event, providerId: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.info('Connectez-vous d abord pour gerer vos favoris.');
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: '/services' },
      });
      return;
    }

    const wasFavorite = this.isProviderFavorite(providerId);
    const action: Observable<FavoriteItem | FavoriteStatus> = wasFavorite
      ? this.favoritesService.remove(providerId)
      : this.favoritesService.add(providerId);

    action.subscribe({
      next: () => {
        this.feedback.success(
          wasFavorite ? 'Prestataire retire des favoris.' : 'Prestataire ajoute aux favoris.',
        );
      },
      error: () => {
        this.feedback.error('Impossible de mettre a jour vos favoris pour le moment.');
      },
    });
  }

  openNegotiation(provider: Professional): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.info('Connectez-vous d abord pour negocier avec ce prestataire.');
    }

    this.router.navigate(['/services', provider.id, 'proposition'], {
      queryParams: {
        ...(provider.serviceId ? { serviceId: provider.serviceId } : {}),
        returnUrl: this.router.url,
      },
      state: {
        provider,
        avatar: this.resolveProviderAvatar(provider),
        photos: this.providerPhotos(provider),
      },
    });
  }
}
