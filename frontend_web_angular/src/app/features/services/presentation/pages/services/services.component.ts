import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { ServiceSection, PaginationMeta } from '../../../domain/models/services.models';
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

  protected readonly heroIllustration =
    'https://www.figma.com/api/mcp/asset/9f194bf6-3fd1-4012-bb76-dc280db53929';
  protected readonly fallbackAvatars = [
    'https://www.figma.com/api/mcp/asset/6fbed90c-597f-4a65-9803-f64e71b550c5',
    'https://www.figma.com/api/mcp/asset/bd04523b-1aa5-479e-806b-1929dcc43dab',
    'https://www.figma.com/api/mcp/asset/8ac6c017-5cd7-4960-a3d2-3e839aa68a3f',
    'https://www.figma.com/api/mcp/asset/fd9a2b60-ecaa-4a48-90cf-61f71dac88d6',
  ];
  protected readonly fallbackPhotos = [
    'https://www.figma.com/api/mcp/asset/86becdf8-4abc-4072-85ff-1b21088f7fd0',
    'https://www.figma.com/api/mcp/asset/69c4201e-99e0-426f-9213-6df5a95fe4e9',
    'https://www.figma.com/api/mcp/asset/dd8f6549-6b09-41ac-b1f1-fe63f6bd292a',
    'https://www.figma.com/api/mcp/asset/d3ba4c59-bc9b-49d2-88b1-48ff60c3f0c4',
    'https://www.figma.com/api/mcp/asset/75efea4c-2efe-4333-ac01-5224440c6148',
    'https://www.figma.com/api/mcp/asset/897d1143-68ee-47bd-9e3e-fafceb170ad4',
    'https://www.figma.com/api/mcp/asset/e7027761-7239-4313-83b7-225104e195f5',
    'https://www.figma.com/api/mcp/asset/99f79ff2-baa5-437c-9f99-5e6e793818da',
  ];

  sections = signal<ServiceSection[]>([]);
  categoryPagination = signal<PaginationMeta | undefined>(undefined);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
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
      avatar: favorite.avatarUrl || undefined,
      photos: [],
      route: `/services/${favorite.professionalId}`,
    })),
  );

  ngOnInit(): void {
    this.loadHomeData();
    this.loadFavorites();
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
        this.isLoading.set(false);
      },
    });
  }

  loadHomeData(page: number = 1): void {
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
        this.isLoading.set(false);
      },
    });
  }

  loadMoreCategories(): void {
    const nextPage = (this.categoryPagination()?.page || 1) + 1;
    this.loadHomeData(nextPage);
  }

  private loadFavorites(): void {
    if (!this.currentUser()) {
      return;
    }

    this.favoritesService.list().subscribe({
      error: () => {
        // Les visiteurs non connectes voient simplement l'etat vide.
      },
    });
  }

  resolveProviderAvatar(provider: { avatar?: string }, index: number): string {
    return provider.avatar || this.fallbackAvatars[index % this.fallbackAvatars.length];
  }

  resolveProviderPhoto(
    provider: { photos: string[] },
    providerIndex: number,
    photoIndex: number,
  ): string {
    return (
      provider.photos[photoIndex] ||
      this.fallbackPhotos[(providerIndex * 2 + photoIndex) % this.fallbackPhotos.length]
    );
  }

  isProviderFavorite(providerId: string): boolean {
    return this.favoritesService
      .favorites()
      .some((favorite) => favorite.professionalId === providerId);
  }

  toggleProviderFavorite(event: Event, providerId: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.currentUser()) {
      this.feedback.success('Connectez-vous pour gerer vos favoris.');
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
        this.feedback.success('Connectez-vous pour gerer vos favoris.');
      },
    });
  }
}
