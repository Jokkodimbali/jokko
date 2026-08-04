import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppStarRatingComponent } from '../../../../../shared/ui/app-star-rating/app-star-rating.component';
import { AppPresenceDotComponent } from '../../../../../shared/ui/app-presence-dot/app-presence-dot.component';
import { ProviderTravelBadgeComponent } from '../provider-travel-badge/provider-travel-badge.component';
import { ProfessionalVehicleType } from '../../../domain/models/services.models';

export interface ProviderCardImage {
  url: string;
  label: string;
}

export interface ProviderCardServiceVisual {
  id: string;
  name: string;
  imageUrl: string | null;
}

export type ProviderCardTravelMode =
  | 'PRESTATAIRE_SE_DEPLACE'
  | 'CLIENT_SE_DEPLACE'
  | 'TRANSPORT_COLIS';

export interface ProviderCardView {
  id: string;
  userId?: string;
  name: string;
  title: string;
  category: string;
  location: string;
  rating: number;
  totalReviews: number;
  vehicleType?: ProfessionalVehicleType;
  isOnline: boolean;
  avatarUrl: string | null;
  initials: string;
  coverUrl: string;
  movementTitle: string;
  travelMode?: ProviderCardTravelMode;
  priceRangeLabel: string;
  isMedical?: boolean;
  images: ProviderCardImage[];
  services: ProviderCardServiceVisual[];
  primaryActionLabel: string;
  profileCommands: readonly unknown[];
  messageCommands?: readonly unknown[];
  queryParams?: Record<string, string> | null;
  messageQueryParams?: Record<string, string> | null;
  state?: Record<string, unknown>;
}

const PROFESSIONAL_VEHICLE_BADGES: Record<
  ProfessionalVehicleType,
  { label: string; imageUrl: string }
> = {
  MOTO_SCOOTER: {
    label: 'Moto / Scooter',
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/moto.png',
  },
  VOITURE: {
    label: 'Voiture',
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/voiture.png',
  },
  CAMIONNETTE: {
    label: 'Camionnette',
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/camionnette.png',
  },
};

const TRAVEL_MODE_IMAGES: Record<ProviderCardTravelMode, string> = {
  CLIENT_SE_DEPLACE: '/mode travel/le_client_se_deplace-removebg-preview.png',
  PRESTATAIRE_SE_DEPLACE: '/mode travel/le_prestataire_se_deplace-removebg-preview.png',
  TRANSPORT_COLIS: '/mode travel/livraisonde_colis-removebg-preview.png',
};

@Component({
  selector: 'app-provider-card',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppStarRatingComponent, AppPresenceDotComponent, ProviderTravelBadgeComponent],
  templateUrl: './provider-card.component.html',
  styleUrl: './provider-card.component.scss',
})
export class ProviderCardComponent {
  private readonly router = inject(Router);

  @Input({ required: true }) provider!: ProviderCardView;
  @Input() isFavorite = false;
  @Input() favoriteLabel = 'Ajouter aux favoris';
  @Input() favoriteActiveLabel = 'Retirer des favoris';

  @Output() favoriteToggle = new EventEmitter<void>();
  @Output() primaryAction = new EventEmitter<void>();
  @Output() imageError = new EventEmitter<string>();

  protected readonly emptySlots = [0, 1];
  protected selectedServiceId: string | null = null;

  protected get ratingText(): string {
    if (this.provider.totalReviews <= 0) {
      return 'Nouveau';
    }

    return this.normalizedRating().toFixed(2);
  }

  protected get reviewsText(): string {
    return this.provider.totalReviews > 0 ? `(${this.provider.totalReviews})` : '';
  }

  private normalizedRating(): number {
    const rating = Math.max(0, Math.min(5, Number(this.provider.rating) || 0));
    return this.provider.totalReviews > 0 && rating <= 0
      ? Math.min(5, this.provider.totalReviews)
      : rating;
  }

  protected get movementImageUrl(): string | null {
    return this.provider.travelMode ? TRAVEL_MODE_IMAGES[this.provider.travelMode] : null;
  }

  protected get movementIcons(): string[] {
    return [];
  }

  protected get vehicleBadge(): { label: string; imageUrl: string } | null {
    return this.provider.travelMode === 'TRANSPORT_COLIS' && this.provider.vehicleType
      ? PROFESSIONAL_VEHICLE_BADGES[this.provider.vehicleType]
      : null;
  }

  protected get serviceVisuals(): ProviderCardServiceVisual[] {
    return this.provider.services.length > 0
      ? this.provider.services
      : this.provider.images.map((image, index) => ({
          id: `${index}`,
          name: image.label,
          imageUrl: image.url,
        }));
  }

  protected get selectedService(): ProviderCardServiceVisual | null {
    const services = this.serviceVisuals;
    if (services.length === 0) {
      return null;
    }

    const selectedId = this.selectedServiceId ?? services[0].id;
    return services.find((service) => service.id === selectedId) ?? services[0];
  }

  protected selectService(event: Event, service: ProviderCardServiceVisual): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedServiceId = service.id;
  }

  protected serviceInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'SV';
  }

  protected onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit();
  }

  protected onPrimaryActionClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.primaryAction.emit();
  }

  protected stopCardNavigation(event: Event): void {
    event.stopPropagation();
  }

  protected openProfile(): void {
    void this.router.navigate(this.provider.profileCommands as unknown[], {
      queryParams: this.provider.queryParams ?? undefined,
      state: this.provider.state,
    });
  }

  protected openProfileFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openProfile();
  }

  protected onImageError(url: string): void {
    this.imageError.emit(url);
  }
}
