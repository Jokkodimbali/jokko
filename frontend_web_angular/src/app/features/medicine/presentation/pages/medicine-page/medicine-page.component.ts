import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { FavoritesService } from '../../../../../core/favorites/favorites.service';
import { MedicineService } from '../../../data-access/medicine.service';
import { MEDICINE_FILTERS } from '../../../domain/medicine-filter-actions';
import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';
import { DoctorProfile, MedicineFilterAction } from '../../../domain/models/medicine.models';
import { DoctorCardComponent } from '../../components/doctor-card/doctor-card.component';
import { MedicineFilterBarComponent } from '../../components/medicine-filter-bar/medicine-filter-bar.component';
import { MedicineHeroComponent } from '../../components/medicine-hero/medicine-hero.component';

@Component({
  selector: 'app-medicine-page',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppScrollHintComponent,
    DoctorCardComponent,
    LucideAngularModule,
    MedicineFilterBarComponent,
    MedicineHeroComponent,
    RouterLink,
  ],
  templateUrl: './medicine-page.component.html',
  styleUrls: [
    './medicine-page.component.scss',
    './medicine-page-responsive.component.scss',
  ],
})
export class MedicinePageComponent implements OnInit {
  private readonly medicineService = inject(MedicineService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly messages = MEDICINE_UI_MESSAGES;
  protected readonly filters = MEDICINE_FILTERS;
  protected readonly doctors = signal<DoctorProfile[]>([]);
  protected readonly showMap = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly mapDoctors = computed(() =>
    this.doctors().filter((doctor) => this.hasPreciseLocation(doctor)),
  );
  protected readonly mapUrl = computed<SafeResourceUrl | null>(() => {
    const center = this.mapCenter();
    if (!center) {
      return null;
    }

    const query = `${center.latitude},${center.longitude}`;
    const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });

  ngOnInit(): void {
    this.loadDoctors();
    this.favoritesService.list().subscribe({ error: () => undefined });
  }

  protected handleFilter(filter: MedicineFilterAction): void {
    if (filter.icon === 'map') {
      this.showMap.update((value) => !value);
    }
  }

  protected mapCardStyle(doctor: DoctorProfile): Record<string, string> {
    const bounds = this.mapBounds();
    if (!bounds || doctor.latitude === null || doctor.longitude === null) {
      return { left: '50%', top: '50%' };
    }

    const longitudeRange = bounds.maxLongitude - bounds.minLongitude || 0.01;
    const latitudeRange = bounds.maxLatitude - bounds.minLatitude || 0.01;
    const left = ((doctor.longitude - bounds.minLongitude) / longitudeRange) * 78 + 11;
    const top = ((bounds.maxLatitude - doctor.latitude) / latitudeRange) * 70 + 15;

    return {
      left: `${this.clamp(left, 12, 88)}%`,
      top: `${this.clamp(top, 16, 84)}%`,
    };
  }

  private mapCenter(): { latitude: number; longitude: number } | null {
    const doctors = this.mapDoctors();
    if (doctors.length === 0) {
      return null;
    }

    return {
      latitude:
        doctors.reduce((sum, doctor) => sum + Number(doctor.latitude), 0) /
        doctors.length,
      longitude:
        doctors.reduce((sum, doctor) => sum + Number(doctor.longitude), 0) /
        doctors.length,
    };
  }

  private mapBounds():
    | {
        minLatitude: number;
        maxLatitude: number;
        minLongitude: number;
        maxLongitude: number;
      }
    | null {
    const doctors = this.mapDoctors();
    if (doctors.length === 0) {
      return null;
    }

    const latitudes = doctors.map((doctor) => Number(doctor.latitude));
    const longitudes = doctors.map((doctor) => Number(doctor.longitude));
    const latitudePadding = Math.max(
      (Math.max(...latitudes) - Math.min(...latitudes)) * 0.25,
      0.01,
    );
    const longitudePadding = Math.max(
      (Math.max(...longitudes) - Math.min(...longitudes)) * 0.25,
      0.01,
    );

    return {
      minLatitude: Math.min(...latitudes) - latitudePadding,
      maxLatitude: Math.max(...latitudes) + latitudePadding,
      minLongitude: Math.min(...longitudes) - longitudePadding,
      maxLongitude: Math.max(...longitudes) + longitudePadding,
    };
  }

  private hasPreciseLocation(doctor: DoctorProfile): boolean {
    return (
      typeof doctor.latitude === 'number' &&
      Number.isFinite(doctor.latitude) &&
      typeof doctor.longitude === 'number' &&
      Number.isFinite(doctor.longitude)
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private loadDoctors(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.medicineService.listDoctors().subscribe({
      next: ({ doctors }) => {
        this.doctors.set(doctors);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger les medecins pour le moment.');
        this.isLoading.set(false);
      },
    });
  }
}
