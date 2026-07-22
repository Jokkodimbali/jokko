import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { FavoriteItem } from '../../../../core/favorites/favorites.service';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { FavoritesService } from '../../../../core/favorites/favorites.service';
import { AccountShellComponent } from '../../../../shared/ui/account-shell/account-shell.component';
import { userInitials } from '../../../../shared/utils/user-initials';
import {
  ProviderCardComponent,
  ProviderCardView,
} from '../../../services/presentation/components/provider-card/provider-card.component';

const SERVICE_CARD_COVER_URL =
  'https://res.cloudinary.com/dobuolool/image/upload/v1784219907/jokko/app-assets/service-card-cover.png';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AccountShellComponent,
    ProviderCardComponent,
  ],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
})
export class FavoritesPageComponent {
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);

  protected readonly favorites = this.favoritesService.favorites;
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly selectedCategory = signal('Tous');
  protected readonly sortBy = signal<'recent' | 'rating' | 'name'>('recent');
  protected readonly availableOnly = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly failedImageUrls = signal<Set<string>>(new Set());

  protected readonly totalFavorites = computed(() => this.favorites().length);
  protected readonly onlineFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.isOnline).length,
  );
  protected readonly availableFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.isAvailableToday).length,
  );
  protected readonly newFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.isNew).length,
  );
  protected readonly categories = computed(() => {
    const values = new Set(
      this.favorites()
        .map((favorite) => favorite.service?.categoryName || favorite.subtitle)
        .filter(Boolean),
    );

    return ['Tous', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'))];
  });
  protected readonly filteredFavorites = computed(() => {
    const category = this.selectedCategory();
    const favorites = this.favorites().filter((favorite) => {
      const matchesCategory =
        category === 'Tous' ||
        (favorite.service?.categoryName || favorite.subtitle) === category;
      const matchesAvailability =
        !this.availableOnly() || favorite.isOnline || favorite.isAvailableToday;

      return matchesCategory && matchesAvailability;
    });

    return [...favorites].sort((left, right) => {
      if (this.sortBy() === 'rating') {
        return right.rating - left.rating || right.totalReviews - left.totalReviews;
      }

      if (this.sortBy() === 'name') {
        return left.name.localeCompare(right.name, 'fr');
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  });

  constructor() {
    if (!this.hasUsableFavoriteSession()) {
      return;
    }

    this.isLoading.set(true);
    this.favoritesService.list().subscribe({
      next: () => {
        this.isLoading.set(false);
        this.errorMessage.set(null);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Impossible de charger vos favoris pour le moment.');
      },
    });
  }

  protected removeFavorite(professionalId: string): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.favoritesService.remove(professionalId).subscribe({
      next: () => this.feedback.success('Favori retire de votre liste.'),
      error: () => {
        this.feedback.error('Impossible de retirer ce favori pour le moment.');
      },
    });
  }

  protected selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  protected toggleAvailableFilter(): void {
    this.availableOnly.update((value) => !value);
  }

  protected shareList(): void {
    const url = window.location.href;
    const text = `Mes favoris Jokko Dimbali: ${this.favorites()
      .map((favorite) => favorite.name)
      .join(', ')}`;

    if (navigator.share) {
      void navigator.share({
        title: 'Mes favoris Jokko Dimbali',
        text,
        url,
      });
      return;
    }

    void navigator.clipboard?.writeText(`${text}\n${url}`);
  }

  protected detailRoute(favorite: FavoriteItem): string[] {
    const category = `${favorite.service?.categoryName ?? ''} ${favorite.subtitle ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return category.includes('medecin') || category.includes('sante')
      ? ['/medecine', favorite.professionalId]
      : ['/services', favorite.professionalId];
  }

  protected initials(name: string): string {
    return userInitials(name);
  }

  protected favoriteCardView(favorite: FavoriteItem): ProviderCardView {
    const images = this.favoriteImages(favorite);
    const route = this.detailRoute(favorite);
    const serviceId = favorite.service?.id;
    const queryParams = serviceId ? { serviceId } : null;
    const isMedical = this.isMedicalFavorite(favorite);
    const travelMode = this.favoriteTravelMode(favorite);
    const messageQueryParams = {
      professionalId: favorite.professionalId,
      providerName: favorite.name,
      ...(serviceId ? { serviceId } : {}),
    };

    return {
      id: favorite.professionalId,
      name: favorite.name,
      title: this.favoriteCardTitle(favorite),
      category: (favorite.service?.categoryName || favorite.subtitle || 'Service').toUpperCase(),
      location: favorite.location,
      rating: favorite.rating,
      totalReviews: favorite.totalReviews,
      isOnline: favorite.isOnline,
      avatarUrl: this.visibleImageUrl(favorite.avatarUrl),
      initials: this.initials(favorite.name),
      coverUrl: SERVICE_CARD_COVER_URL,
      movementTitle: this.favoriteMovementTitle(travelMode),
      travelMode,
      priceRangeLabel: this.favoritePriceRangeLabel(favorite),
      isMedical,
      images,
      services: favorite.service
        ? [{
            id: favorite.service.id,
            name: favorite.service.name,
            imageUrl: images[0]?.url ?? null,
          }]
        : [],
      primaryActionLabel: isMedical ? 'Prendre rendez-vous' : 'Negocier',
      profileCommands: route,
      messageCommands: ['/messages'],
      queryParams,
      messageQueryParams,
      state: { favorite },
    };
  }

  private favoritePriceRangeLabel(favorite: FavoriteItem): string {
    const price = Number(favorite.service?.price);
    if (!Number.isFinite(price) || price <= 0) {
      return favorite.service?.priceType === 'NEGOCIABLE' ? 'Prix negociable' : 'Tarif a confirmer';
    }

    const suffix = favorite.service?.travelMode === 'TRANSPORT_COLIS' ? ' FCFA/KM' : ' FCFA';
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.trunc(price))}${suffix}`;
  }

  protected handleImageError(url: string | null | undefined): void {
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

  protected openFavoritePrimaryAction(favorite: FavoriteItem): void {
    if (this.isMedicalFavorite(favorite)) {
      this.router.navigate(['/medecine', favorite.professionalId, 'rendez-vous'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.router.navigate(['/services', favorite.professionalId, 'proposition'], {
      queryParams: {
        ...(favorite.service?.id ? { serviceId: favorite.service.id } : {}),
        returnUrl: this.router.url,
      },
      state: { favorite },
    });
  }

  private visibleImageUrl(url: string | null | undefined): string | null {
    const value = url?.trim();
    if (!value || this.failedImageUrls().has(value)) {
      return null;
    }

    return value;
  }

  private favoriteImages(favorite: FavoriteItem) {
    return favorite.portfolioImages
      .map((image) => ({
        url: image.url.trim(),
        label: image.title || favorite.service?.name || favorite.subtitle || 'Realisation',
      }))
      .filter((image) => image.url.length > 0 && !this.failedImageUrls().has(image.url))
      .slice(0, 2);
  }

  private favoriteMovementTitle(travelMode: NonNullable<ProviderCardView['travelMode']>): string {
    switch (travelMode) {
      case 'CLIENT_SE_DEPLACE':
        return 'Vous vous deplacez chez lui';
      case 'TRANSPORT_COLIS':
        return 'Trajet personnalise';
      case 'PRESTATAIRE_SE_DEPLACE':
      default:
        return 'Il se deplace chez vous';
    }
  }

  private favoriteCardTitle(favorite: FavoriteItem): string {
    const labels = (
      favorite.service?.subCategoryNames?.length
        ? favorite.service.subCategoryNames
        : [favorite.service?.subCategoryName]
    )
      .map((label) => label?.trim())
      .filter((label): label is string => Boolean(label));

    if (labels.length > 0) {
      const visibleLabels = labels.slice(0, 3);
      const remainingCount = labels.length - visibleLabels.length;
      return remainingCount > 0
        ? `${visibleLabels.join(' / ')} +${remainingCount}`
        : visibleLabels.join(' / ');
    }

    return favorite.subtitle || favorite.service?.name || 'Sous categorie non renseignee';
  }

  private isMedicalFavorite(favorite: FavoriteItem): boolean {
    const category = this.favoriteSearchText(favorite);
    return category.includes('medecin') || category.includes('sante');
  }

  private favoriteTravelMode(favorite: FavoriteItem): NonNullable<ProviderCardView['travelMode']> {
    return favorite.service?.travelMode ?? this.legacyFavoriteTravelMode(favorite);
  }

  private legacyFavoriteTravelMode(favorite: FavoriteItem): NonNullable<ProviderCardView['travelMode']> {
    return this.isTransportFavorite(favorite) ? 'TRANSPORT_COLIS' : 'PRESTATAIRE_SE_DEPLACE';
  }

  private isTransportFavorite(favorite: FavoriteItem): boolean {
    const category = this.favoriteSearchText(favorite);
    return category.includes('transport') || category.includes('livraison');
  }

  private favoriteSearchText(favorite: FavoriteItem): string {
    return `${favorite.service?.categoryName ?? ''} ${favorite.subtitle ?? ''} ${favorite.service?.name ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private hasUsableFavoriteSession(): boolean {
    const token = this.authSession.getAccessToken();
    if (!this.currentUser() || !token) return false;

    const [, payload] = token.split('.');
    if (!payload) return false;

    try {
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(
        normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
        '=',
      );
      const decoded = JSON.parse(window.atob(paddedPayload)) as { exp?: unknown };
      if (typeof decoded.exp !== 'number') return true;
      const isExpired = decoded.exp * 1000 <= Date.now();
      if (isExpired) {
        this.authSession.clear();
        return false;
      }
      return true;
    } catch {
      this.authSession.clear();
      return false;
    }
  }
}
