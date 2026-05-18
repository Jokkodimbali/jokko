import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { FavoritesService } from '../../../../../core/favorites/favorites.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { ServicesService } from '../../../../services/data-access/services.service';
import {
  BackendProfessionalAvailability,
  ProviderProfileDetail,
} from '../../../../services/domain/models/services.models';
import { MEDICINE_DOCTORS } from '../../../domain/medicine.mock';
import { DoctorProfile } from '../../../domain/models/medicine.models';

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
    AppScrollHintComponent,
    LucideAngularModule,
  ],
  templateUrl: './medicine-doctor-profile.component.html',
  styleUrl: './medicine-doctor-profile.component.scss',
})
export class MedicineDoctorProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly feedback = inject(AppFeedbackService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly servicesService = inject(ServicesService);
  private readonly navigationState = (history.state || {}) as { doctor?: DoctorProfile };

  private readonly initialDoctor =
    this.navigationState.doctor ||
    MEDICINE_DOCTORS.find((item) => item.id === this.route.snapshot.paramMap.get('id')) ||
    MEDICINE_DOCTORS[0];
  protected readonly doctor = signal<DoctorProfile>(this.initialDoctor);
  protected readonly coverUrl = '/boabab.png';
  protected readonly mapUrl = computed<SafeResourceUrl>(() => {
    const doctor = this.doctor();
    const query =
      typeof doctor.latitude === 'number' && typeof doctor.longitude === 'number'
        ? `${doctor.latitude},${doctor.longitude}`
        : doctor.location;
    const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });
  protected readonly isFavorite = signal(false);
  protected readonly isTogglingFavorite = signal(false);
  protected readonly schedule = signal<DoctorScheduleRow[]>([]);

  ngOnInit(): void {
    const profileId = this.route.snapshot.paramMap.get('id');
    if (profileId) {
      this.servicesService.getProviderProfileDetail(profileId).subscribe({
        next: (detail) => {
          this.doctor.set(this.mapDoctor(detail));
          this.schedule.set(this.buildSchedule(detail.availabilities));
        },
        error: () => undefined,
      });
    }

    if (!this.authSession.hasAuthenticatedSession()) return;

    this.favoritesService.status(this.doctor().id).subscribe({
      next: (status) => this.isFavorite.set(status.isFavorite),
      error: () => undefined,
    });
  }

  protected goBack(): void {
    this.location.back();
  }

  protected toggleFavorite(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.success('Connectez-vous pour gerer vos favoris.');
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
        this.feedback.success('Impossible de mettre a jour vos favoris.');
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
    const nextAvailability = this.buildNextAvailabilityLabels(detail.availabilities);

    return {
      id: profile.id,
      name: profile.nomEntreprise || profile.utilisateur.nom,
      specialty: primaryService?.nom || 'Consultation medicale',
      rating: profile.noteGlobale || 0,
      reviewCount: profile.nombreAvis || 0,
      location: (profile.ville || 'Senegal').toUpperCase(),
      latitude: profile.latitude,
      longitude: profile.longitude,
      imageUrl: profile.utilisateur.urlAvatar || this.initialDoctor.imageUrl,
      isOnline: detail.presence.isOnline,
      nextAvailability,
      modes: ['Teleconsult', 'Cabinet'],
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

      labels.push(
        formatter
          .format(date)
          .replace('.', '')
          .replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
      );
    }

    return labels;
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
