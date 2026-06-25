import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

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

@Component({
  selector: 'app-provider-card',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './provider-card.component.html',
  styleUrl: './provider-card.component.scss',
})
export class ProviderCardComponent {
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

  protected onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit();
  }

  protected onImageError(url: string): void {
    this.imageError.emit(url);
  }
}
