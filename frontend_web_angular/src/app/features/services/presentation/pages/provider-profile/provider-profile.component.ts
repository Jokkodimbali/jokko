import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  FavoriteItem,
  FavoriteStatus,
  FavoritesService,
} from '../../../../../core/favorites/favorites.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppStarRatingComponent } from '../../../../../shared/ui/app-star-rating/app-star-rating.component';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { ServicesService } from '../../../data-access/services.service';
import {
  BackendProfessionalAvailability,
  BackendProfessionalPresence,
  ProfessionalVehicleType,
  ProviderProfileDetail,
  ServiceTravelMode,
} from '../../../domain/models/services.models';

interface ScheduleRow {
  day: string;
  slots: string[];
}

interface OfferedServiceVisual {
  id: string;
  name: string;
  imageUrl: string | null;
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

const TRAVEL_MODE_IMAGES: Record<ServiceTravelMode, string> = {
  CLIENT_SE_DEPLACE: '/mode travel/le_client_se_deplace-removebg-preview.png',
  PRESTATAIRE_SE_DEPLACE: '/mode travel/le_prestataire_se_deplace-removebg-preview.png',
  TRANSPORT_COLIS: '/mode travel/livraisonde_colis-removebg-preview.png',
};

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppNavbarComponent,
    AppStarRatingComponent,
    LucideAngularModule,
    RouterLink,
  ],
  templateUrl: './provider-profile.component.html',
  styleUrl: './provider-profile.component.scss',
})
export class ProviderProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly servicesService = inject(ServicesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly detail = signal<ProviderProfileDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly failedImageUrls = signal<Set<string>>(new Set());
  protected readonly selectedVisualServiceId = signal<string | null>(null);

  protected readonly profileId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly selectedServiceId = this.route.snapshot.queryParamMap.get('serviceId') || '';
  protected readonly defaultCoverUrl = '/boabab.png';

  protected readonly displayName = computed(() => {
    const profile = this.detail()?.profile;
    return profile?.nomEntreprise || profile?.utilisateur.nom || 'Prestataire';
  });

  protected readonly primaryService = computed(() => {
    const services = this.detail()?.services ?? [];
    return services.find((service) => service.id === this.selectedServiceId) ?? services[0] ?? null;
  });
  protected readonly speciality = computed(() => this.primaryService()?.nom || 'Service');
  protected readonly aboutTitle = computed(() => 'À propos de moi');
  protected readonly serviceQueryParams = computed(() => {
    const serviceId = this.primaryService()?.id;
    return {
      ...(serviceId ? { serviceId } : {}),
      returnUrl: `/services/${this.profileId}`,
    };
  });
  protected readonly messageQueryParams = computed(() => {
    const profile = this.detail()?.profile;
    const serviceId = this.primaryService()?.id;

    return {
      professionalId: this.profileId,
      ...(profile?.utilisateurId ? { professionalUserId: profile.utilisateurId } : {}),
      providerName: this.displayName(),
      ...(serviceId ? { serviceId } : {}),
    };
  });
  protected readonly avatarUrl = computed(() => this.detail()?.profile.utilisateur.urlAvatar ?? null);
  protected readonly initials = computed(() => userInitials(this.displayName()));
  protected readonly coverUrl = computed(() => this.defaultCoverUrl);
  protected readonly offeredServices = computed<OfferedServiceVisual[]>(() =>
    (this.detail()?.services ?? [])
      .filter((service) => service.estDisponible)
      .map((service) => ({
        id: service.id,
        name: service.nom,
        imageUrl: this.visibleImageUrl(service.urlImage) || null,
      })),
  );
  protected readonly selectedVisualService = computed(() => {
    const services = this.offeredServices();
    const selectedId = this.selectedVisualServiceId() || this.primaryService()?.id;
    return services.find((service) => service.id === selectedId) ?? services[0] ?? null;
  });
  protected readonly reviewItems = computed(() =>
    (this.detail()?.reviews ?? []).slice(0, 2),
  );
  protected formatReviewInitials(name: string): string {
    return userInitials(name);
  }

  protected serviceVisualInitials(title: string): string {
    return userInitials(title);
  }

  protected selectVisualService(service: OfferedServiceVisual): void {
    this.selectedVisualServiceId.set(service.id);
  }
  protected readonly ratingLabel = computed(() => {
    const rating = Number(this.detail()?.profile.noteGlobale ?? 0);
    return rating > 0 ? rating.toFixed(1).replace('.', ',') : 'Nouveau';
  });
  protected readonly reviewTotalLabel = computed(() => {
    const total = this.detail()?.profile.nombreAvis ?? 0;
    return `${this.formatNumber(total)} avis`;
  });
  private readonly professionalBiography = computed(() => {
    const biography = this.detail()?.profile.biographie ?? '';
    const lines = biography
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const readLine = (label: string): string => {
      const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
      return line?.split(':').slice(1).join(':').trim() || '';
    };
    const expertises = readLine('Expertises')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const labeledAbout =
      readLine('Bio') ||
      readLine('Description') ||
      readLine('Presentation') ||
      readLine('Présentation');
    const about = (labeledAbout ? [labeledAbout] : lines)
      .filter((line) => !/^(Specialite|Expertises|Documents):/i.test(line))
      .join(' ')
      .trim();

    return {
      about,
      expertises: [...new Set(expertises)],
    };
  });
  protected readonly bio = computed(
    () => this.professionalBiography().about || "Ce prestataire n'a pas encore renseigné sa présentation.",
  );
  protected readonly priceLabel = computed(() => {
    const price = this.primaryService()?.prix;
    if (typeof price !== 'number' || price <= 0) {
      return this.isFixedPriceService() ? 'Tarif a renseigner' : 'Prix sur devis';
    }

    return `${this.formatNumber(price)} FCFA`;
  });
  protected readonly isFixedPriceService = computed(
    () => this.primaryService()?.typePrix === 'FIXE',
  );
  protected readonly priceTypeLabel = computed(() =>
    this.isFixedPriceService() ? '/prix fixe' : '/negociable',
  );
  protected readonly priceActionLabel = computed(() =>
    this.isFixedPriceService() ? 'Prendre rendez-vous' : 'Negociez le prix',
  );
  protected readonly priceActionIcon = computed(() =>
    this.isFixedPriceService() ? 'calendar-check' : 'banknote-arrow-down',
  );
  protected readonly priceHelper = computed(() =>
    this.isFixedPriceService()
      ? 'Prenez rendez-vous avec ce prestataire en selectionnant la date, l heure et le motif de prestation qui vous conviennent.'
      : 'Ce service est negociable. Envoyez votre proposition au prestataire pour ouvrir la discussion.',
  );
  protected readonly pricingIntroLabel = computed(() =>
    this.isFixedPriceService() ? 'Rendez-vous' : 'Tarif a confirmer',
  );
  protected readonly serviceBookingText = computed(() =>
    this.isFixedPriceService()
      ? 'Prenez rendez-vous avec ce prestataire en selectionnant la date, l heure et le motif de prestation qui vous conviennent.'
      : 'Le montant final depend du motif choisi et des details de votre demande. Envoyez votre proposition au prestataire pour confirmer le prix.',
  );
  protected readonly experienceLabel = computed(() => {
    const createdAt = this.detail()?.profile.creeLe;
    if (!createdAt) return 'Nouveau';

    const years = Math.max(0, new Date().getFullYear() - new Date(createdAt).getFullYear());
    return years > 0 ? `${years} ans` : 'Nouveau';
  });
  protected readonly servicesCountLabel = computed(() => `${this.detail()?.services.length ?? 0}`);
  protected readonly reviewsCountLabel = computed(() => `${this.detail()?.profile.nombreAvis ?? 0}`);
  protected readonly vehicleBadge = computed(() => {
    const hasParcelDelivery = (this.detail()?.services ?? []).some(
      (service) => service.estDisponible && service.modeDeplacement === 'TRANSPORT_COLIS',
    );
    if (!hasParcelDelivery) return null;
    const vehicleType = this.detail()?.profile.typeVehicule;
    return vehicleType ? PROFESSIONAL_VEHICLE_BADGES[vehicleType] : null;
  });
  protected readonly primaryTravelMode = computed(() => {
    const modes = new Set(
      (this.detail()?.services ?? [])
        .filter((service) => service.estDisponible)
        .map((service) => service.modeDeplacement)
        .filter(Boolean),
    );
    if (modes.has('PRESTATAIRE_SE_DEPLACE') && modes.has('CLIENT_SE_DEPLACE')) return null;
    if (modes.has('CLIENT_SE_DEPLACE')) return 'CLIENT_SE_DEPLACE';
    if (modes.has('TRANSPORT_COLIS')) return 'TRANSPORT_COLIS';
    if (modes.has('PRESTATAIRE_SE_DEPLACE')) return 'PRESTATAIRE_SE_DEPLACE';
    return null;
  });
  protected readonly travelModeLabel = computed(() => {
    const services = this.detail()?.services ?? [];
    const modes = new Set(
      services
        .filter((service) => service.estDisponible)
        .map((service) => service.modeDeplacement)
        .filter(Boolean),
    );
    if (modes.has('PRESTATAIRE_SE_DEPLACE') && modes.has('CLIENT_SE_DEPLACE')) {
      return 'Deplacement flexible';
    }
    if (modes.has('CLIENT_SE_DEPLACE')) return 'Le client se deplace';
    if (modes.has('TRANSPORT_COLIS')) return 'Transport de colis';
    return 'Le prestataire se deplace';
  });
  protected readonly travelModeImageUrl = computed(() => {
    const mode = this.primaryTravelMode();
    return mode ? TRAVEL_MODE_IMAGES[mode] : null;
  });
  protected readonly travelModeBadgeClass = computed(() => {
    const mode = this.primaryTravelMode();
    if (mode === 'PRESTATAIRE_SE_DEPLACE') return 'provider-profile__movement-badge--provider';
    if (mode === 'TRANSPORT_COLIS') return 'provider-profile__movement-badge--parcel';
    if (mode === 'CLIENT_SE_DEPLACE') return 'provider-profile__movement-badge--client';
    return 'provider-profile__movement-badge--flexible';
  });
  protected readonly presenceLabel = computed(() => this.formatPresence(this.detail()?.presence ?? null));
  protected readonly isOnline = computed(() => this.detail()?.presence?.isOnline === true);
  protected readonly isFavorite = signal(false);
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly expertiseTags = computed(() => this.professionalBiography().expertises);
  protected readonly schedule = computed(() => this.buildSchedule(this.detail()?.availabilities ?? []));
  protected readonly scheduleSlotsCount = computed(() =>
    this.schedule().reduce((total, row) => total + row.slots.length, 0),
  );
  protected readonly scheduleSummary = computed(() => {
    const daysCount = this.schedule().length;
    const slotsCount = this.scheduleSlotsCount();
    if (daysCount === 0) return 'Aucun horaire publie';
    return `${daysCount} jour${daysCount > 1 ? 's' : ''} actif${daysCount > 1 ? 's' : ''} · ${slotsCount} plage${slotsCount > 1 ? 's' : ''}`;
  });
  protected readonly mapUrl = computed<SafeResourceUrl | null>(() => {
    const detail = this.detail();
    const coordinates = this.resolveMapCoordinates(detail);
    const query = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : detail?.profile.ville || '';
    if (!query) {
      return null;
    }

    const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });

  ngOnInit(): void {
    this.loadProviderDetail();
  }

  protected goBack(): void {
    this.backNavigation.back(
      this.route.snapshot.queryParamMap.get('returnUrl'),
      '/services',
    );
  }

  protected loadProviderDetail(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.servicesService.getProviderProfileDetail(this.profileId).subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.selectedVisualServiceId.set(this.primaryService()?.id ?? detail.services[0]?.id ?? null);
          this.isLoading.set(false);
        this.loadFavoriteStatus();
      },
      error: () => {
        this.errorMessage.set('Impossible de charger ce prestataire pour le moment.');
        this.isLoading.set(false);
      },
    });
  }

  protected formatLocation(): string {
    return this.detail()?.profile.ville || 'Localisation non renseignee';
  }

  protected formatPhone(): string {
    return this.detail()?.profile.utilisateur.numeroTelephone || 'Telephone non renseigne';
  }

  protected formatReviewDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  protected visibleImageUrl(url: string | null | undefined): string | null {
    const value = url?.trim();
    if (!value || this.failedImageUrls().has(value)) {
      return null;
    }

    return value;
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

  protected toggleFavorite(): void {
    const detail = this.detail();
    if (!detail) return;

    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.info('Connectez-vous pour gerer vos favoris.');
      return;
    }

    const action: Observable<FavoriteItem | FavoriteStatus> = this.isFavorite()
      ? this.favoritesService.remove(detail.profile.id)
      : this.favoritesService.add(detail.profile.id);

    action.subscribe({
      next: () => {
        const isNowFavorite = !this.isFavorite();
        this.isFavorite.set(isNowFavorite);
        this.feedback.success(
          isNowFavorite ? 'Ajoute aux favoris.' : 'Retire des favoris.',
        );
      },
      error: () => {
        this.feedback.error('Impossible de mettre a jour vos favoris pour le moment.');
      },
    });
  }

  private loadFavoriteStatus(): void {
    if (!this.profileId || !this.authSession.hasAuthenticatedSession()) return;

    this.favoritesService.status(this.profileId).subscribe({
      next: (status) => this.isFavorite.set(status.isFavorite),
      error: () => this.isFavorite.set(false),
    });
  }

  private resolveMapCoordinates(detail: ProviderProfileDetail | null): {
    latitude: number;
    longitude: number;
  } | null {
    const liveLatitude = detail?.presence.lastLatitude;
    const liveLongitude = detail?.presence.lastLongitude;
    if (this.isValidCoordinate(liveLatitude, liveLongitude)) {
      return { latitude: liveLatitude, longitude: liveLongitude as number };
    }

    const profileLatitude = detail?.profile.latitude;
    const profileLongitude = detail?.profile.longitude;
    if (this.isValidCoordinate(profileLatitude, profileLongitude)) {
      return { latitude: profileLatitude, longitude: profileLongitude as number };
    }

    return null;
  }

  private isValidCoordinate(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): latitude is number {
    return typeof latitude === 'number' && Number.isFinite(latitude)
      && typeof longitude === 'number' && Number.isFinite(longitude);
  }

  private buildSchedule(availabilities: BackendProfessionalAvailability[]): ScheduleRow[] {
    const rows = new Map<number, string[]>();

    for (const availability of availabilities) {
      if (!availability.estActive) continue;
      const slots = rows.get(availability.jourSemaine) ?? [];
      slots.push(`${this.formatTime(availability.heureDebut)} - ${this.formatTime(availability.heureFin)}`);
      rows.set(availability.jourSemaine, slots);
    }

    return [1, 2, 3, 4, 5, 6, 0]
      .filter((day) => rows.has(day))
      .map((day) => ({ day: this.dayName(day), slots: rows.get(day) ?? [] }));
  }

  private dayName(day: number): string {
    return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][day] || 'Jour';
  }

  private formatPresence(presence: BackendProfessionalPresence | null): string {
    if (!presence) return '';

    const labels: Record<BackendProfessionalPresence['status'], string> = {
      HORS_LIGNE: 'Hors ligne',
      EN_LIGNE: 'En ligne',
      EN_ROUTE: 'En route',
      EN_PRESTATION: 'En prestation',
    };

    return labels[presence.status];
  }

  private formatTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}h${minutes}`;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }
}
