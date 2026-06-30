import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { FavoritesService } from '../../../../../core/favorites/favorites.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { ServicesService } from '../../../../services/data-access/services.service';
import {
  BackendProfessionalAvailability,
  ProviderProfileDetail,
} from '../../../../services/domain/models/services.models';
import { DoctorProfile } from '../../../domain/models/medicine.models';

import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';

interface DoctorScheduleRow {
  dayLabel: string;
  ranges: string[];
}

@Component({
  selector: 'app-medicine-doctor-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppFooterComponent,
    AppNavbarComponent,
    LucideAngularModule,
  ],
  templateUrl: './medicine-doctor-profile.component.html',
  styleUrl: './medicine-doctor-profile.component.scss',
})
export class MedicineDoctorProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly feedback = inject(AppFeedbackService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly servicesService = inject(ServicesService);
  private readonly navigationState = (history.state || {}) as { doctor?: DoctorProfile };

  private readonly routeProfileId = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly initialDoctor =
    this.navigationState.doctor || this.buildEmptyDoctor(this.routeProfileId);
  protected readonly detail = signal<ProviderProfileDetail | null>(null);
  protected readonly doctor = signal<DoctorProfile>(this.initialDoctor);
  protected readonly coverUrl = '/boabab.png';
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly failedImageUrls = signal<Set<string>>(new Set());
  protected readonly mapUrl = computed<SafeResourceUrl | null>(() => {
    const doctor = this.doctor();
    if (
      typeof doctor.latitude !== 'number' ||
      !Number.isFinite(doctor.latitude) ||
      typeof doctor.longitude !== 'number' ||
      !Number.isFinite(doctor.longitude)
    ) {
      return null;
    }

    const query = `${doctor.latitude},${doctor.longitude}`;
    const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });
  protected readonly phoneLabel = computed(
    () => this.detail()?.profile.utilisateur.numeroTelephone || 'Telephone non renseigne',
  );
  protected readonly isFavorite = signal(false);
  protected readonly isTogglingFavorite = signal(false);
  protected readonly schedule = signal<DoctorScheduleRow[]>([]);
  protected readonly messages = MEDICINE_UI_MESSAGES;
  protected readonly activeSchedule = computed(() =>
    this.schedule().filter((row) => row.ranges.length > 0),
  );
  protected readonly scheduleSummary = computed(() => {
    const daysCount = this.activeSchedule().length;
    const slotsCount = this.activeSchedule().reduce((total, row) => total + row.ranges.length, 0);
    if (daysCount === 0) return 'Aucun horaire publie';
    return `${daysCount} jour${daysCount > 1 ? 's' : ''} actif${daysCount > 1 ? 's' : ''} · ${slotsCount} plage${slotsCount > 1 ? 's' : ''}`;
  });

  ngOnInit(): void {
    const profileId = this.routeProfileId;
    if (!profileId) {
      this.errorMessage.set('Profil medecin introuvable.');
      return;
    }

    if (profileId) {
      this.servicesService.getProviderProfileDetail(profileId).subscribe({
        next: (detail) => {
          this.errorMessage.set(null);
          this.detail.set(detail);
          this.doctor.set(this.mapDoctor(detail));
          this.schedule.set(this.buildSchedule(detail.availabilities));
        },
        error: () => this.errorMessage.set('Impossible de charger les informations du medecin.'),
      });
    }

    if (!this.authSession.hasAuthenticatedSession()) return;

    this.favoritesService.status(this.doctor().id).subscribe({
      next: (status) => this.isFavorite.set(status.isFavorite),
      error: () => undefined,
    });
  }

  protected goBack(): void {
    this.backNavigation.back(
      this.route.snapshot.queryParamMap.get('returnUrl'),
      '/services',
    );
  }

  protected doctorInitials(): string {
    return userInitials(this.doctor().name, 'JD');
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
    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.info('Connectez-vous d abord pour gerer vos favoris.');
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    if (this.isTogglingFavorite()) return;

    const wasFavorite = this.isFavorite();
    this.isTogglingFavorite.set(true);

    const subscription = {
      next: () => {
        this.isFavorite.set(!wasFavorite);
        this.isTogglingFavorite.set(false);
        this.feedback.success(
          wasFavorite ? 'Medecin retire des favoris.' : 'Medecin ajoute aux favoris.',
        );
      },
      error: () => {
        this.isTogglingFavorite.set(false);
        this.feedback.error('Impossible de mettre a jour vos favoris.');
      },
    };

    if (wasFavorite) {
      this.favoritesService.remove(this.doctor().id).subscribe(subscription);
      return;
    }

    this.favoritesService.add(this.doctor().id).subscribe(subscription);
  }

  private mapDoctor(detail: ProviderProfileDetail): DoctorProfile {
    const primaryService = detail.services.find((service) => service.estDisponible) ?? detail.services[0];
    const profile = detail.profile;
    const medicalSpecialty = this.extractMedicalSpecialty(profile.biographie);
    const nextAvailability = this.buildNextAvailabilityLabels(detail.availabilities);
    const interventionAddress = profile.utilisateur.adresse || profile.ville || 'Localisation non renseignee';
    const modes = Array.from(new Set(
      detail.services
        .map(s => s.modeDeplacement === 'PRESTATAIRE_SE_DEPLACE' ? MEDICINE_UI_MESSAGES.modes.remote : MEDICINE_UI_MESSAGES.modes.office)
        .filter(Boolean) as string[]
    ));

    return {
      id: profile.id,
      name: profile.nomEntreprise || profile.utilisateur.nom,
      specialty: primaryService?.nom || medicalSpecialty || 'Médecin', // Use service name as priority
      rating: profile.noteGlobale || 0,
      reviewCount: profile.nombreAvis || 0,
      location: interventionAddress.toUpperCase(),
      latitude: profile.latitude,
      longitude: profile.longitude,
      imageUrl: profile.utilisateur.urlAvatar || '',
      isOnline: detail.presence.isOnline,
      modes: modes,
      nextAvailability,
      availability: [
        {
          period: 'Prochaines dispos',
          days: nextAvailability,
        },
      ],
    };
  }

  private buildNextAvailabilityLabels(availabilities: BackendProfessionalAvailability[]): string[] {
    const activeWeekdays = new Set(
      availabilities
        .filter((availability) => availability.estActive)
        .map((availability) => availability.jourSemaine),
    );

    if (activeWeekdays.size === 0) return [];

    const formatter = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
    });
    const labels: string[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 21 && labels.length < 4; offset += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + offset);
      if (!activeWeekdays.has(date.getDay())) continue;

      const label = formatter.format(date).replace('.', '').trim();
      labels.push(label.charAt(0).toUpperCase() + label.slice(1));
    }

    return labels;
  }

  private extractMedicalSpecialty(bio: string | null): string | null {
    if (!bio) return null;
    const match = bio.match(/Specialite\s*:\s*([^\n]+)/i);
    return match?.[1]?.trim() || null;
  }

  private buildSchedule(availabilities: BackendProfessionalAvailability[]): DoctorScheduleRow[] {
    const dayLabels = new Map([
      [1, 'Lundi'],
      [2, 'Mardi'],
      [3, 'Mercredi'],
      [4, 'Jeudi'],
      [5, 'Vendredi'],
      [6, 'Samedi'],
      [0, 'Dimanche'],
    ]);
    const grouped = new Map<number, string[]>();

    for (const availability of availabilities.filter((item) => item.estActive)) {
      const ranges = grouped.get(availability.jourSemaine) ?? [];
      ranges.push(
        `${this.formatAvailabilityTime(availability.heureDebut)} - ${this.formatAvailabilityTime(availability.heureFin)}`,
      );
      grouped.set(availability.jourSemaine, ranges);
    }

    return Array.from(dayLabels.entries()).map(([day, dayLabel]) => ({
      dayLabel,
      ranges: grouped.get(day) ?? [],
    }));
  }

  private buildEmptyDoctor(profileId: string): DoctorProfile {
    return {
      id: profileId,
      name: 'Medecin',
      specialty: 'Motif non renseigne',
      rating: 0,
      reviewCount: 0,
      location: 'Localisation non renseignee',
      latitude: null,
      longitude: null,
      imageUrl: '',
      isOnline: false,
      modes: [],
      availability: [],
      nextAvailability: [],
    };
  }

  private formatAvailabilityTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 5);
    }

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}h${minutes}`;
  }
}
