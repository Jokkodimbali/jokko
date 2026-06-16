import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
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
import { ServiceSection, PaginationMeta, Professional } from '../../../domain/models/services.models';
import { SERVICES_UI_MESSAGES } from '../../../domain/services-ui.messages';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { AppSearchBarComponent } from '../../../../../shared/ui/app-search-bar/app-search-bar.component';

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
export class ServicesComponent implements OnInit {
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
  failedImageUrls = signal<Set<string>>(new Set());
  readonly locationValue = 'Toute zone';
  protected readonly currentUser = this.authSession.currentUser;
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
      isOnline: false,
      onlineLabel: 'Favori',
      avatar: favorite.avatarUrl || undefined,
      photos: favorite.portfolioImages.map((image) => image.url).filter(Boolean),
      route: `/services/${favorite.professionalId}`,
    })),
  );

  ngOnInit(): void {
    this.loadHomeData();
    this.loadFavorites();
  }

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
  }

  submitSearch(value: string): void {
    const query = value.trim();

    if (!query) {
      this.loadHomeData();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.categoryPagination.set(undefined);
    this.servicesService.searchProfessionals(query, 1, 6).subscribe({
      next: (result) => {
        this.sections.set([
          {
            id: 'search-results',
            title: `Recherche ${query}`,
            countLabel: `${result.meta?.total || result.providers.length} professionnels`,
            providers: result.providers,
            pagination: result.meta,
          },
        ]);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(SERVICES_UI_MESSAGES.loadServicesFailed);
        this.feedback.error(SERVICES_UI_MESSAGES.loadServicesFailed);
        this.isLoading.set(false);
      },
    });
  }

  onViewAll(section: ServiceSection): void {
    const nextPage = (section.pagination?.page || 1) + 1;
    if (section.pagination && nextPage > section.pagination.totalPages) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.servicesService.getProfessionalsByCategory(section.id, nextPage, 6).subscribe({
      next: (result) => {
        this.sections.update((sects) =>
          sects.map((s) =>
            s.id === section.id
              ? {
                  ...s,
                  providers: [...s.providers, ...result.providers],
                  pagination: result.meta,
                }
              : s,
          ),
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(SERVICES_UI_MESSAGES.loadMoreProfessionalsFailed);
        this.feedback.error(SERVICES_UI_MESSAGES.loadMoreProfessionalsFailed);
        this.isLoading.set(false);
      },
    });
  }

  loadHomeData(page: number = 1): void {
    if (page === 1) {
      this.searchTerm.set('');
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.servicesService.getServiceHomeData(page, 5).subscribe({
      next: (result) => {
        if (page === 1) {
          this.sections.set(result.sections);
        } else {
          this.sections.update((s) => [...s, ...result.sections]);
        }
        this.categoryPagination.set(result.meta);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(SERVICES_UI_MESSAGES.loadServicesFailed);
        this.feedback.error(SERVICES_UI_MESSAGES.loadServicesFailed);
        this.isLoading.set(false);
      },
    });
  }

  loadMoreCategories(): void {
    const nextPage = (this.categoryPagination()?.page || 1) + 1;
    this.loadHomeData(nextPage);
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
    switch (provider.serviceTravelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'Le client se deplace';
      case 'TRANSPORT_COLIS':
        return 'Transport de colis';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'Le prestataire se deplace';
    }
  }

  providerMovementIcon(provider: Professional): string {
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
    switch (provider.serviceTravelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'Rendez-vous chez le prestataire';
      case 'TRANSPORT_COLIS':
        return 'Colis pris en charge du point A au point B';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'Intervention a votre adresse';
    }
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

    const action: Observable<FavoriteItem | FavoriteStatus> = this.isProviderFavorite(providerId)
      ? this.favoritesService.remove(providerId)
      : this.favoritesService.add(providerId);

    action.subscribe({
      next: () => {
        this.feedback.success(
          this.isProviderFavorite(providerId)
            ? 'Prestataire ajoute aux favoris.'
            : 'Prestataire retire des favoris.',
        );
      },
      error: () => {
        this.feedback.error('Impossible de mettre a jour vos favoris pour le moment.');
      },
    });
  }
}
