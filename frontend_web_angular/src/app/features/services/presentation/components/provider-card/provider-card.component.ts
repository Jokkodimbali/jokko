import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ProfessionalVehicleType } from '../../../domain/models/services.models';

export interface ProviderCardImage {
  url: string;
  label: string;
}

export type ProviderCardTravelMode =
  | 'PRESTATAIRE_SE_DEPLACE'
  | 'CLIENT_SE_DEPLACE'
  | 'TRANSPORT_COLIS';

export interface ProviderCardView {
  id: string;
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
  isMedical?: boolean;
  images: ProviderCardImage[];
  primaryActionLabel: string;
  profileCommands: readonly unknown[];
  queryParams?: Record<string, string> | null;
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

@Component({
  selector: 'app-provider-card',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
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

  protected get ratingText(): string {
    if (this.provider.totalReviews <= 0) {
      return 'Nouveau';
    }

    return this.provider.rating.toFixed(2);
  }

  protected get reviewsText(): string {
    return this.provider.totalReviews > 0 ? `(${this.provider.totalReviews})` : '';
  }

  protected get movementImageUrl(): string | null {
    if (this.provider.travelMode === 'TRANSPORT_COLIS') {
      return '/parcel-transport-route.png';
    }

    if (this.provider.travelMode === 'PRESTATAIRE_SE_DEPLACE') {
      return '/provider-travels-to-client.png';
    }

    if (this.provider.travelMode === 'CLIENT_SE_DEPLACE') {
      return '/client-travels-to-provider.png';
    }

    return null;
  }

  protected get movementIcons(): string[] {
    return [];
  }

  protected get vehicleBadge(): { label: string; imageUrl: string } | null {
    return this.provider.travelMode === 'TRANSPORT_COLIS' && this.provider.vehicleType
      ? PROFESSIONAL_VEHICLE_BADGES[this.provider.vehicleType]
      : null;
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
