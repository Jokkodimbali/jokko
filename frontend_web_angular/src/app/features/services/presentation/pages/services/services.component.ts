import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, Subscription } from 'rxjs';
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
import {
  AppSearchBarComponent,
  AppSearchCategorySuggestion,
  AppSearchProviderSuggestion,
} from '../../../../../shared/ui/app-search-bar/app-search-bar.component';
import { userInitials } from '../../../../../shared/utils/user-initials';
import {
  ProviderCardComponent,
  ProviderCardView,
} from '../../components/provider-card/provider-card.component';

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
    ProviderCardComponent,
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
export class ServicesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('serviceFilters')
  private readonly serviceFilterRefs?: QueryList<ElementRef<HTMLElement>>;

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
  selectedCity = signal<string>('Toutes villes');
  showSearchSuggestions = signal<boolean>(false);
  showLocationMenu = signal<boolean>(false);
  suggestionProviders = signal<Professional[]>([]);
  readonly cityOptions = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack'];
  protected readonly locationOptions = computed(() => ['Toutes villes', ...this.cityOptions]);
  protected readonly locationValue = computed(() => this.selectedCity());
  protected readonly searchResultsNearLabel = computed(() =>
    this.effectiveCityFilter()
      ? `Resultats pres de ${this.selectedCity()}`
      : 'Resultats dans toutes les villes',
  );
  protected readonly searchCategorySuggestions = computed<AppSearchCategorySuggestion[]>(() => {
    const providerCounts = new Map<string, number>();

    for (const provider of this.suggestionProviders()) {
      const key = this.normalizeLabel(provider.categoryName);
      providerCounts.set(key, (providerCounts.get(key) ?? 0) + 1);
    }

    return this.categories()
      .map((category, index) => ({
        id: category.id,
        name: category.nom,
        count: providerCounts.get(this.normalizeLabel(category.nom)) ?? category.subCategories.length,
        icon: this.categoryIcon(category.nom),
        priority: this.categorySuggestionPriority(category.nom, index),
      }))
      .sort((current, next) => current.priority - next.priority)
      .map(({ priority: _priority, ...category }) => category);
  });
  protected readonly searchProviderSuggestions = computed<AppSearchProviderSuggestion[]>(() =>
    this.suggestionProviders().slice(0, 3).map((provider) => ({
      id: provider.id,
      name: provider.nom,
      category: provider.categoryName || 'Service',
      profession: this.providerProfessionLabel(provider),
      location: provider.location,
      rating: provider.rating,
      totalReviews: provider.totalReviews,
      isOnline: provider.isOnline,
      avatarUrl: this.resolveProviderAvatar(provider),
      initials: this.providerInitials(provider.nom),
    })),
  );
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
      categoryName: favorite.subtitle,
      subCategoryName: favorite.service?.subCategoryName || favorite.subtitle,
      subCategoryNames: favorite.service?.subCategoryNames || [favorite.service?.subCategoryName || favorite.subtitle].filter(Boolean),
      professionName: favorite.subtitle,
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
  private suggestionRequestVersion = 0;
  private requestVersion = 0;
  private serviceFilterWheelCleanups: Array<() => void> = [];
  private serviceFilterRefsChangesSubscription?: Subscription;

  ngOnInit(): void {
    this.loadCategories();
    this.loadFavorites();
    this.loadHomeData();
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
    this.clearServiceFilterWheelListeners();
    this.serviceFilterRefsChangesSubscription?.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.bindServiceFilterWheelListeners();
    this.serviceFilterRefsChangesSubscription = this.serviceFilterRefs?.changes.subscribe(() => {
      this.bindServiceFilterWheelListeners();
    });
  }

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
    this.showSearchSuggestions.set(true);
    this.showLocationMenu.set(false);
    this.clearSearchDebounce();
    this.searchDebounce = setTimeout(() => {
      this.loadProfessionals(1);
      this.loadSearchSuggestions();
    }, 280);
  }

  submitSearch(value: string): void {
    this.searchTerm.set(value.trim());
    this.showSearchSuggestions.set(false);
    this.showLocationMenu.set(false);
    this.clearSearchDebounce();
    this.loadProfessionals(1);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.clearSearchDebounce();
    this.loadProfessionals(1);
  }

  openSearchSuggestions(): void {
    this.showSearchSuggestions.set(true);
    this.showLocationMenu.set(false);
    if (this.suggestionProviders().length === 0) {
      this.loadSearchSuggestions();
    }
  }

  toggleLocationMenu(): void {
    this.showLocationMenu.update((value) => !value);
    this.showSearchSuggestions.set(false);
  }

  selectSearchCity(city: string): void {
    this.selectedCity.set(city);
    this.showLocationMenu.set(false);
    this.loadProfessionals(1);
    this.loadSearchSuggestions();
  }

  useCurrentLocation(): void {
    this.selectSearchCity('Dakar');
  }

  closeSearchSuggestionsAndShowFilters(): void {
    this.showSearchSuggestions.set(false);
    this.showLocationMenu.set(false);
    this.cycleFilter();
  }

  closeSearchPanels(): void {
    this.showSearchSuggestions.set(false);
    this.showLocationMenu.set(false);
  }

  selectSearchCategory(categoryId: string): void {
    this.showSearchSuggestions.set(false);
    this.selectCategory(categoryId);
  }

  selectSuggestedProvider(providerId: string): void {
    const provider = this.suggestionProviders().find((current) => current.id === providerId)
      ?? this.sections().flatMap((section) => section.providers).find((current) => current.id === providerId);

    this.showSearchSuggestions.set(false);
    this.showLocationMenu.set(false);

    if (!provider) {
      this.router.navigate(['/services', providerId]);
      return;
    }

    this.router.navigate(this.providerProfileCommands(provider), {
      queryParams: provider.serviceId ? { serviceId: provider.serviceId } : undefined,
      state: {
        provider,
        avatar: this.resolveProviderAvatar(provider),
        photos: this.providerPhotos(provider),
      },
    });
  }

  scrollFiltersWithWheel(event: WheelEvent, targetElement?: HTMLElement): void {
    if (event.ctrlKey) {
      return;
    }

    const container = targetElement ?? (event.currentTarget as HTMLElement | null);
    if (!container) {
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft <= 0) {
      return;
    }

    const modeMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : 1;
    const rawDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const delta = rawDelta * modeMultiplier;
    if (delta === 0) {
      return;
    }

    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + delta));
    if (nextScrollLeft === container.scrollLeft) {
      return;
    }

    event.preventDefault();
    container.scrollLeft = nextScrollLeft;
  }

  private bindServiceFilterWheelListeners(): void {
    this.clearServiceFilterWheelListeners();

    this.serviceFilterRefs?.forEach((reference) => {
      const element = reference.nativeElement;
      const handleWheel = (event: WheelEvent) => this.scrollFiltersWithWheel(event, element);
      element.addEventListener('wheel', handleWheel, { passive: false });
      this.serviceFilterWheelCleanups.push(() => {
        element.removeEventListener('wheel', handleWheel);
      });
    });
  }

  private clearServiceFilterWheelListeners(): void {
    this.serviceFilterWheelCleanups.forEach((cleanup) => cleanup());
    this.serviceFilterWheelCleanups = [];
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

  private effectiveCityFilter(): string | undefined {
    const city = this.selectedCity().trim();
    return city && city !== 'Toutes villes' ? city : undefined;
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
    const city = this.effectiveCityFilter();

    if (filter === 'ALL') {
      return this.servicesService.searchUnifiedProfessionals(query, page, 24, city, categoryId, subCategoryId);
    }

    return this.servicesService.searchProfessionalsByRole(filter, query, page, 24, city, categoryId, subCategoryId);
  }

  private loadSearchSuggestions(): void {
    const query = this.searchTerm().trim();
    const requestId = ++this.suggestionRequestVersion;

    this.servicesService.searchUnifiedProfessionals(query, 1, 6, this.effectiveCityFilter()).subscribe({
      next: (result) => {
        if (requestId !== this.suggestionRequestVersion) {
          return;
        }

        setTimeout(() => {
          if (requestId === this.suggestionRequestVersion) {
            this.suggestionProviders.set(result.providers);
          }
        });
      },
      error: () => {
        if (requestId !== this.suggestionRequestVersion) {
          return;
        }

        setTimeout(() => {
          if (requestId === this.suggestionRequestVersion) {
            this.suggestionProviders.set([]);
          }
        });
      },
    });
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
    return userInitials(name);
  }

  providerPhotos(provider: { photos: string[] }): string[] {
    return provider.photos
      .map((photo) => photo.trim())
      .filter((photo) => photo.length > 0 && !this.failedImageUrls().has(photo))
      .slice(0, 6);
  }

  providerCategoryLabel(provider: Professional): string {
    return (provider.categoryName || provider.speciality || 'Service').toUpperCase();
  }

  private normalizeLabel(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private categorySuggestionPriority(categoryName: string, index: number): number {
    const normalized = this.normalizeLabel(categoryName);
    if (
      normalized.includes('medec') ||
      normalized.includes('sante') ||
      normalized.includes('sant')
    ) {
      return -1000;
    }

    return index;
  }

  private categoryIcon(categoryName: string): string {
    const normalized = this.normalizeLabel(categoryName);

    if (normalized.includes('medec')) {
      return 'stethoscope';
    }

    if (normalized.includes('voiture') || normalized.includes('auto')) {
      return 'truck';
    }

    if (normalized.includes('cuisine') || normalized.includes('restauration')) {
      return 'flame';
    }

    return 'wrench';
  }

  providerProfessionLabel(provider: Professional): string {
    return provider.professionName || provider.speciality || 'Profession non renseignee';
  }

  providerSubCategoryLabel(provider: Professional): string {
    const labels = (provider.subCategoryNames?.length ? provider.subCategoryNames : [provider.subCategoryName])
      .map((label) => label?.trim())
      .filter((label): label is string => Boolean(label));

    return labels.length > 0
      ? labels.join(' • ')
      : provider.professionName || provider.speciality || 'Sous categorie non renseignee';
  }

  providerPortfolioLabel(provider: Professional, index: number): string {
    if (index === 0) {
      return this.providerProfessionLabel(provider);
    }

    return provider.serviceTravelMode === 'TRANSPORT_COLIS'
      ? 'Livraison express'
      : provider.profileType === 'MEDECIN'
        ? 'Consultation'
        : 'Intervention';
  }

  providerCardSubCategoryLabel(provider: Professional): string {
    const labels = (provider.subCategoryNames?.length ? provider.subCategoryNames : [provider.subCategoryName])
      .map((label) => label?.trim())
      .filter((label): label is string => Boolean(label));

    if (labels.length > 0) {
      const visibleLabels = labels.slice(0, 3);
      const remainingCount = labels.length - visibleLabels.length;
      return remainingCount > 0
        ? `${visibleLabels.join(' / ')} +${remainingCount}`
        : visibleLabels.join(' / ');
    }

    return provider.professionName || provider.speciality || 'Sous categorie non renseignee';
  }

  providerMovementTitle(provider: Professional): string {
    switch (provider.serviceTravelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'Vous vous deplacez chez lui';
      case 'TRANSPORT_COLIS':
        return 'Trajet personnalise';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'Il se deplace chez vous';
    }
  }

  providerProfileCommands(provider: Professional): unknown[] {
    return ['/services', provider.id];
  }

  providerActionLabel(provider: Professional): string {
    return provider.profileType === 'MEDECIN' ? 'Prendre rendez-vous' : 'Negocier le prix';
  }

  providerCardView(provider: Professional): ProviderCardView {
    const photos = this.providerPhotos(provider);
    const queryParams = provider.serviceId ? { serviceId: provider.serviceId } : null;
    const profileCommands = this.providerProfileCommands(provider);

    return {
      id: provider.id,
      name: provider.nom,
      title: this.providerCardSubCategoryLabel(provider),
      category: this.providerCategoryLabel(provider),
      location: provider.location,
      rating: provider.rating,
      totalReviews: provider.totalReviews,
      isOnline: provider.isOnline,
      avatarUrl: this.resolveProviderAvatar(provider),
      initials: this.providerInitials(provider.nom),
      coverUrl: '/boabab.png',
      movementTitle: this.providerMovementTitle(provider),
      travelMode: provider.serviceTravelMode,
      isMedical: provider.profileType === 'MEDECIN',
      images: photos.slice(0, 2).map((url, index) => ({
        url,
        label: this.providerPortfolioLabel(provider, index),
      })),
      primaryActionLabel: this.providerActionLabel(provider),
      profileCommands,
      queryParams,
      state: {
        provider,
        avatar: this.resolveProviderAvatar(provider),
        photos,
      },
    };
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

  toggleProviderFavorite(providerId: string): void {
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
