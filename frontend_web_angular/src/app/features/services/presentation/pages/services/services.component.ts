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
import { clearHttpResponseCache } from '../../../../../core/http/http-cache.interceptor';
import {
  FavoriteItem,
  FavoriteStatus,
  FavoritesService,
} from '../../../../../core/favorites/favorites.service';
import { ProfessionalSearchLocation, ServicesService } from '../../../data-access/services.service';
import {
  CatalogAccountStatusChangedEvent,
  CatalogProfileChangedEvent,
  CatalogRealtimeService,
} from '../../../data-access/catalog-realtime.service';
import {
  CategoryStructure,
  ServiceSection,
  PaginationMeta,
  Professional,
  ServiceTravelMode,
  ServiceSubCategory,
} from '../../../domain/models/services.models';
import { SERVICES_UI_MESSAGES } from '../../../domain/services-ui.messages';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { AppPresenceDotComponent } from '../../../../../shared/ui/app-presence-dot/app-presence-dot.component';
import {
  AppSearchBarComponent,
  AppSearchCategorySuggestion,
  AppSearchProviderSuggestion,
} from '../../../../../shared/ui/app-search-bar/app-search-bar.component';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { GoogleMapsLoaderService } from '../../../../../shared/maps/google-maps-loader.service';
import {
  ProviderCardComponent,
  ProviderCardView,
} from '../../components/provider-card/provider-card.component';

type ProfessionalFilter = 'ALL' | 'MEDECIN' | 'PRESTATAIRE';
type TravelModeFilter = 'ALL' | ServiceTravelMode;
const SERVICE_CARD_COVER_URL =
  'https://res.cloudinary.com/dobuolool/image/upload/v1784219907/jokko/app-assets/service-card-cover.png';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppFooterComponent,
    AppNavbarComponent,
    AppScrollHintComponent,
    AppPresenceDotComponent,
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
  private readonly googleMaps = inject(GoogleMapsLoaderService);
  private readonly catalogRealtime = inject(CatalogRealtimeService);

  protected readonly heroIllustration = '/image%20haut.png';

  sections = signal<ServiceSection[]>([]);
  categoryPagination = signal<PaginationMeta | undefined>(undefined);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  searchTerm = signal<string>('');
  activeFilter = signal<ProfessionalFilter>('ALL');
  activeCategoryId = signal<string | null>(null);
  activeSubCategoryId = signal<string | null>(null);
  activeTravelMode = signal<TravelModeFilter>('ALL');
  categories = signal<CategoryStructure[]>([]);
  failedImageUrls = signal<Set<string>>(new Set());
  selectedCity = signal<string>('Toutes villes');
  currentSearchLocation = signal<ProfessionalSearchLocation | null>(null);
  isLocating = signal<boolean>(false);
  showSearchSuggestions = signal<boolean>(false);
  showLocationMenu = signal<boolean>(false);
  suggestionProviders = signal<Professional[]>([]);
  readonly cityOptions = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack'];
  protected readonly locationOptions = computed(() => ['Toutes villes', ...this.cityOptions]);
  protected readonly locationValue = computed(() => this.selectedCity());
  protected readonly searchResultsNearLabel = computed(() =>
    this.currentSearchLocation()
      ? 'Résultats proches de votre position'
      : this.effectiveCityFilter()
        ? `Résultats près de ${this.selectedCity()}`
        : 'Résultats dans toutes les villes',
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
      userId: provider.userId,
      name: provider.nom,
      category: provider.categoryName || 'Service',
      profession: this.providerProfessionLabel(provider),
      location: provider.location,
      rating: provider.rating,
      totalReviews: provider.totalReviews,
      vehicleType: provider.vehicleType,
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
  protected readonly travelModeFilters = [
    { value: 'ALL', label: 'Tout', tone: 'all' as const },
    {
      value: 'CLIENT_SE_DEPLACE',
      label: 'Vous vous deplacez',
      imageUrl: '/mode travel/le_client_se_deplace-removebg-preview.png',
      tone: 'client' as const,
    },
    {
      value: 'TRANSPORT_COLIS',
      label: 'Trajet personnalise',
      imageUrl: '/mode travel/livraisonde_colis-removebg-preview.png',
      tone: 'route' as const,
    },
    {
      value: 'PRESTATAIRE_SE_DEPLACE',
      label: 'Il se deplace chez vous',
      imageUrl: '/mode travel/le_prestataire_se_deplace-removebg-preview.png',
      tone: 'provider' as const,
    },
  ];
  favoriteProviders = computed(() =>
    this.favoritesService.favorites()
      .filter((favorite) => !this.isOwnProfessionalIdentity(favorite.professionalId))
      .map((favorite) => ({
      id: favorite.professionalId,
      nom: favorite.name,
      categoryName: favorite.subtitle,
      subCategoryName: favorite.service?.subCategoryName || favorite.subtitle,
      subCategoryNames: favorite.service?.subCategoryNames || [favorite.service?.subCategoryName || favorite.subtitle].filter(Boolean),
      professionName: favorite.subtitle,
      speciality: favorite.subtitle,
      location: this.humanLocationLabel(favorite.location),
      status: favorite.totalReviews > 0
        ? `${favorite.rating}/5 (${favorite.totalReviews} avis)`
        : 'Favori',
      rating: favorite.rating,
      totalReviews: favorite.totalReviews,
      vehicleType: favorite.service?.travelMode === 'TRANSPORT_COLIS' ? favorite.vehicleType : undefined,
      isOnline: favorite.isOnline,
      onlineLabel: favorite.isOnline ? 'En ligne' : 'Favori',
      avatar: favorite.avatarUrl || undefined,
      photos: favorite.portfolioImages.map((image) => image.url).filter(Boolean),
      services: [],
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
      this.activeTravelMode() !== 'ALL' ||
      this.activeCategoryId() !== null ||
      this.activeSubCategoryId() !== null ||
      this.effectiveCityFilter() !== undefined ||
      this.currentSearchLocation() !== null,
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
  private professionalsRequestSubscription?: Subscription;
  private suggestionsRequestSubscription?: Subscription;
  private allTravelModesSnapshot: { contextKey: string; providers: Professional[] } | null = null;
  private readonly locationLabelCache = new Map<string, string>();
  private serviceFilterWheelCleanups: Array<() => void> = [];
  private serviceFilterRefsChangesSubscription?: Subscription;
  private catalogRealtimeSubscription?: Subscription;
  private catalogProfileSubscription?: Subscription;

  ngOnInit(): void {
    this.loadCategories();
    this.loadFavorites();
    this.loadHomeData();
    this.catalogRealtimeSubscription = this.catalogRealtime
      .watchAccountStatuses()
      .subscribe((event) => this.applyCatalogAccountStatus(event));
    this.catalogProfileSubscription = this.catalogRealtime
      .watchProfiles()
      .subscribe((event) => this.applyCatalogProfile(event));
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
    this.professionalsRequestSubscription?.unsubscribe();
    this.suggestionsRequestSubscription?.unsubscribe();
    this.clearServiceFilterWheelListeners();
    this.serviceFilterRefsChangesSubscription?.unsubscribe();
    this.catalogRealtimeSubscription?.unsubscribe();
    this.catalogProfileSubscription?.unsubscribe();
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

  private applyCatalogAccountStatus(event: CatalogAccountStatusChangedEvent): void {
    this.requestVersion += 1;
    this.suggestionRequestVersion += 1;
    this.professionalsRequestSubscription?.unsubscribe();
    this.suggestionsRequestSubscription?.unsubscribe();
    this.servicesService.clearCache();
    clearHttpResponseCache();

    if (event.active) {
      this.loadProfessionals(1);
      this.loadSearchSuggestions();
      return;
    }

    const excludesAccount = (provider: Professional) =>
      provider.userId === event.userId || provider.id === event.professionalId;

    this.sections.update((sections) =>
      sections.map((section) => {
        const providers = section.providers.filter((provider) => !excludesAccount(provider));
        const removedCount = section.providers.length - providers.length;
        if (!removedCount) return section;

        return {
          ...section,
          providers,
          countLabel: section.countLabel.replace(/^\d+/, (count) =>
            String(Math.max(0, Number(count) - removedCount)),
          ),
        };
      }),
    );
    this.suggestionProviders.update((providers) =>
      providers.filter((provider) => !excludesAccount(provider)),
    );
    if (this.allTravelModesSnapshot) {
      this.allTravelModesSnapshot = {
        ...this.allTravelModesSnapshot,
        providers: this.allTravelModesSnapshot.providers.filter((provider) => !excludesAccount(provider)),
      };
    }

    this.loadProfessionals(1);
    this.loadSearchSuggestions();
  }

  private applyCatalogProfile(event: CatalogProfileChangedEvent): void {
    this.servicesService.clearCache();
    clearHttpResponseCache();
    const updateProvider = (provider: Professional): Professional =>
      provider.id === event.professionalId || provider.userId === event.userId
        ? {
            ...provider,
            location: event.address || 'Adresse non renseignee',
            latitude: event.latitude,
            longitude: event.longitude,
          }
        : provider;

    this.sections.update((sections) =>
      sections.map((section) => ({
        ...section,
        providers: section.providers.map(updateProvider),
      })),
    );
    this.suggestionProviders.update((providers) => providers.map(updateProvider));
    if (this.allTravelModesSnapshot) {
      this.allTravelModesSnapshot = {
        ...this.allTravelModesSnapshot,
        providers: this.allTravelModesSnapshot.providers.map(updateProvider),
      };
    }
    this.loadProfessionals(1);
    this.loadSearchSuggestions();
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
    this.currentSearchLocation.set(null);
    this.selectedCity.set(city);
    this.showLocationMenu.set(false);
    this.loadProfessionals(1);
    this.loadSearchSuggestions();
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.feedback.error('La géolocalisation n’est pas prise en charge par ce navigateur.');
      return;
    }

    this.isLocating.set(true);
    this.showLocationMenu.set(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.currentSearchLocation.set({
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusKm: 25,
        });
        this.selectedCity.set('Ma position actuelle');
        this.isLocating.set(false);
        this.loadProfessionals(1);
        this.loadSearchSuggestions();
      },
      (error) => {
        this.isLocating.set(false);
        const message = error.code === error.PERMISSION_DENIED
          ? 'Autorisez l’accès à votre position pour afficher les prestataires réellement proches.'
          : 'Votre position n’a pas pu être déterminée. Réessayez dans un endroit avec un meilleur signal GPS.';
        this.feedback.error(message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  selectTravelMode(mode: string): void {
    const nextMode = this.isTravelModeFilter(mode) ? mode : 'ALL';
    if (this.activeTravelMode() === nextMode) {
      return;
    }

    this.clearSearchDebounce();
    this.activeTravelMode.set(nextMode);
    this.showSearchSuggestions.set(false);
    this.showLocationMenu.set(false);
    this.applyTravelModeImmediately(nextMode);
    this.loadProfessionals(1);
    this.loadSearchSuggestions();
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
    if (this.currentSearchLocation()) return undefined;
    const city = this.selectedCity().trim();
    return city && city !== 'Toutes villes' && city !== 'Ma position actuelle' ? city : undefined;
  }

  private loadProfessionals(page: number = 1, appendToSection?: ServiceSection): void {
    const query = this.searchTerm().trim();
    const requestId = ++this.requestVersion;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.professionalsRequestSubscription?.unsubscribe();
    this.professionalsRequestSubscription = this.fetchProfessionals(query, page).subscribe({
      next: (result) => {
        if (requestId !== this.requestVersion) {
          return;
        }

        if (page === 1 && this.activeTravelMode() === 'ALL') {
          this.allTravelModesSnapshot = {
            contextKey: this.travelModeContextKey(),
            providers: result.providers,
          };
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
          this.resolveProviderLocationLabels(section.providers);
        } else {
          this.sections.set([section]);
          this.resolveProviderLocationLabels(section.providers);
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
    const travelMode = this.activeServiceTravelMode();
    const location = this.currentSearchLocation() ?? undefined;

    if (filter === 'ALL') {
      return this.servicesService.searchUnifiedProfessionals(query, page, 24, city, categoryId, subCategoryId, travelMode, location);
    }

    return this.servicesService.searchProfessionalsByRole(filter, query, page, 24, city, categoryId, subCategoryId, travelMode, location);
  }

  private loadSearchSuggestions(): void {
    const query = this.searchTerm().trim();
    const requestId = ++this.suggestionRequestVersion;
    const travelMode = this.activeServiceTravelMode();

    this.suggestionsRequestSubscription?.unsubscribe();
    this.suggestionsRequestSubscription = this.servicesService.searchUnifiedProfessionals(
      query,
      1,
      6,
      this.effectiveCityFilter(),
      undefined,
      undefined,
      travelMode,
      this.currentSearchLocation() ?? undefined,
    ).subscribe({
      next: (result) => {
        if (requestId !== this.suggestionRequestVersion) {
          return;
        }

        setTimeout(() => {
          if (requestId === this.suggestionRequestVersion) {
            const visibleProviders = this.withoutConnectedProfessional(result.providers);
            this.suggestionProviders.set(visibleProviders);
            this.resolveProviderLocationLabels(visibleProviders);
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
    const activeTravelModeLabel = this.travelModeFilters.find((filter) => filter.value === this.activeTravelMode())?.label;
    const providers = this.withoutConnectedProfessional(result.providers);
    const hiddenOwnProviderCount = result.providers.length - providers.length;
    const total = Math.max(0, (result.meta?.total || result.providers.length) - hiddenOwnProviderCount);
    const title = query
      ? `Recherche ${query}`
      : this.activeTravelMode() !== 'ALL' && activeTravelModeLabel
        ? activeTravelModeLabel
      : activeSubCategory
        ? activeSubCategory.nom
        : activeCategory
        ? activeCategory.nom
        : this.activeFilter() === 'ALL'
          ? 'Tous les prestataires'
          : activeFilter.label;

    return {
      id: `providers-${this.activeFilter().toLowerCase()}-${this.activeCategoryId() ?? 'all'}-${this.activeSubCategoryId() ?? 'all'}-${this.activeTravelMode().toLowerCase()}`,
      title,
      countLabel: `${total} ${activeCategory || activeSubCategory ? 'profils disponibles' : activeFilter.countLabel}`,
      providers,
      pagination: result.meta,
    };
  }

  private withoutConnectedProfessional(providers: Professional[]): Professional[] {
    return providers.filter((provider) => !this.isOwnProfessionalIdentity(provider.id, provider.userId));
  }

  private isOwnProfessionalIdentity(professionalId: string, professionalUserId?: string): boolean {
    const currentUser = this.authSession.currentUser();
    if (!currentUser || (currentUser.role !== 'PRESTATAIRE' && currentUser.role !== 'MEDECIN')) {
      return false;
    }

    return (
      professionalUserId === currentUser.id ||
      professionalId === currentUser.professionalProfile?.id
    );
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

  private isTravelModeFilter(mode: string): mode is TravelModeFilter {
    return mode === 'ALL' ||
      mode === 'PRESTATAIRE_SE_DEPLACE' ||
      mode === 'CLIENT_SE_DEPLACE' ||
      mode === 'TRANSPORT_COLIS';
  }

  private activeServiceTravelMode(): ServiceTravelMode | undefined {
    const mode = this.activeTravelMode();
    return mode === 'ALL' ? undefined : mode;
  }

  private applyTravelModeImmediately(mode: TravelModeFilter): void {
    const snapshot = this.allTravelModesSnapshot;
    if (!snapshot || snapshot.contextKey !== this.travelModeContextKey()) {
      this.sections.set([]);
      return;
    }

    const providers = mode === 'ALL'
      ? snapshot.providers
      : snapshot.providers.filter((provider) => provider.serviceTravelMode === mode);
    this.sections.set([this.buildSection({ providers }, this.searchTerm().trim())]);
    this.categoryPagination.set(undefined);
  }

  private travelModeContextKey(): string {
    return [
      this.searchTerm().trim().toLowerCase(),
      this.activeFilter(),
      this.activeCategoryId() ?? '',
      this.activeSubCategoryId() ?? '',
      this.effectiveCityFilter() ?? '',
    ].join('|');
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

  providerCardCategoryLabel(provider: Professional): string {
    const labels = (provider.subCategoryNames?.length ? provider.subCategoryNames : [provider.subCategoryName])
      .map((label) => label?.trim())
      .filter((label): label is string => Boolean(label));

    if (labels.length === 0) {
      return (provider.professionName || provider.speciality || 'Sous categorie non renseignee').toUpperCase();
    }

    return labels.length > 1 ? `${labels[0].toUpperCase()} +${labels.length - 1}` : labels[0].toUpperCase();
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
    return provider.profileType === 'MEDECIN' ? 'Prendre rendez-vous' : 'Negocier';
  }

  providerCardView(provider: Professional): ProviderCardView {
    const photos = this.providerPhotos(provider);
    const queryParams = provider.serviceId ? { serviceId: provider.serviceId } : null;
    const profileCommands = this.providerProfileCommands(provider);
    const messageQueryParams = {
      professionalId: provider.id,
      ...(provider.userId ? { professionalUserId: provider.userId } : {}),
      providerName: provider.nom,
      ...(provider.serviceId ? { serviceId: provider.serviceId } : {}),
    };

    return {
      id: provider.id,
      userId: provider.userId,
      name: provider.nom,
      title: this.providerCardSubCategoryLabel(provider),
      category: this.providerCardCategoryLabel(provider),
      location: this.humanLocationLabel(provider.location),
      rating: provider.rating,
      totalReviews: provider.totalReviews,
      vehicleType: provider.serviceTravelMode === 'TRANSPORT_COLIS' ? provider.vehicleType : undefined,
      isOnline: provider.isOnline,
      avatarUrl: this.resolveProviderAvatar(provider),
      initials: this.providerInitials(provider.nom),
      coverUrl: SERVICE_CARD_COVER_URL,
      movementTitle: this.providerMovementTitle(provider),
      travelMode: provider.serviceTravelMode,
      priceRangeLabel: this.providerPriceRangeLabel(provider),
      isMedical: provider.profileType === 'MEDECIN',
      images: photos.slice(0, 2).map((url, index) => ({
        url,
        label: this.providerPortfolioLabel(provider, index),
      })),
      services: this.providerServiceVisuals(provider),
      primaryActionLabel: this.providerActionLabel(provider),
      profileCommands,
      messageCommands: ['/messages'],
      queryParams,
      messageQueryParams,
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

  providerPriceRangeLabel(provider: Professional): string {
    const prices = provider.services
      .map((service) => Number(service.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    const min = prices.length ? Math.min(...prices) : provider.servicePriceMin;
    const max = prices.length ? Math.max(...prices) : provider.servicePriceMax;
    const suffix = provider.serviceTravelMode === 'TRANSPORT_COLIS' ? ' FCFA/KM' : ' FCFA';

    if (!min && !max) {
      return provider.servicePriceType === 'NEGOCIABLE' ? 'Prix negociable' : 'Tarif a confirmer';
    }

    if (!max || min === max) {
      return `${this.formatCompactAmount(min ?? max ?? 0)}${suffix}`;
    }

    return `${this.formatCompactAmount(min ?? 0)}-${this.formatCompactAmount(max)}${suffix}`;
  }

  providerServiceVisuals(provider: Professional): ProviderCardView['services'] {
    return provider.services
      .filter((service) => service.name.trim())
      .slice(0, 10)
      .map((service) => ({
        id: service.id,
        name: service.name,
        imageUrl: service.urlImage?.trim() || null,
      }));
  }

  private formatCompactAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.trunc(value));
  }

  private humanLocationLabel(value: string | null | undefined): string {
    const label = value?.trim();
    if (!label) {
      return 'Localisation non renseignee';
    }

    const [mainLocation, ...details] = label.split(' - ');
    const readableLocation = this.looksLikeCoordinates(mainLocation)
      ? 'Dakar, Senegal'
      : mainLocation;

    return [readableLocation, ...details].join(' - ');
  }

  private resolveProviderLocationLabels(providers: Professional[]): void {
    for (const provider of providers) {
      if (!this.hasUsableCoordinate(provider)) {
        continue;
      }

      const cacheKey = this.providerCoordinateKey(provider);
      if (!cacheKey) {
        continue;
      }

      const cachedLabel = this.locationLabelCache.get(cacheKey);
      if (cachedLabel) {
        this.applyResolvedProviderLocation(provider.id, cachedLabel);
        continue;
      }

      this.googleMaps
        .reverseGeocode({
          latitude: provider.latitude as number,
          longitude: provider.longitude as number,
        })
        .subscribe({
          next: (result) => {
            const label = this.humanMapAddressLabel(result?.formattedAddress || provider.location);
            if (!label || this.looksLikeCoordinates(label)) {
              return;
            }

            this.locationLabelCache.set(cacheKey, label);
            this.applyResolvedProviderLocation(provider.id, label);
          },
          error: () => undefined,
        });
    }
  }

  private applyResolvedProviderLocation(providerId: string, addressLabel: string): void {
    this.sections.update((sections) =>
      sections.map((section) => {
        const providerIndex = section.providers.findIndex((provider) => provider.id === providerId);
        if (providerIndex < 0) {
          return section;
        }

        const provider = section.providers[providerIndex];
        const location = this.mergeLocationDistance(provider.location, addressLabel);
        if (location === provider.location) {
          return section;
        }

        const providers = [...section.providers];
        providers[providerIndex] = { ...provider, location };
        return { ...section, providers };
      }),
    );

    this.suggestionProviders.update((providers) =>
      providers.map((provider) =>
        provider.id === providerId
          ? { ...provider, location: this.mergeLocationDistance(provider.location, addressLabel) }
          : provider,
      ),
    );
  }

  protected trackBySectionId(_index: number, section: ServiceSection): string {
    return section.id;
  }

  protected trackByProviderId(_index: number, provider: Professional): string {
    return provider.id;
  }

  private mergeLocationDistance(currentLocation: string, addressLabel: string): string {
    const details = currentLocation
      .split(' - ')
      .slice(1)
      .filter((part) => part.trim().length > 0);
    return [addressLabel, ...details].join(' - ');
  }

  private humanMapAddressLabel(value: string): string {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }

  private hasUsableCoordinate(provider: Professional): boolean {
    return (
      typeof provider.latitude === 'number' &&
      Number.isFinite(provider.latitude) &&
      typeof provider.longitude === 'number' &&
      Number.isFinite(provider.longitude)
    );
  }

  private providerCoordinateKey(provider: Professional): string | null {
    if (!this.hasUsableCoordinate(provider)) {
      return null;
    }

    return `${(provider.latitude as number).toFixed(6)},${(provider.longitude as number).toFixed(6)}`;
  }

  private looksLikeCoordinates(value: string): boolean {
    return /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value.trim());
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
