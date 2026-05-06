import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { FavoritesService } from '../../../../../core/favorites/favorites.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { MEDICINE_DOCTORS } from '../../../domain/medicine.mock';
import { DoctorProfile } from '../../../domain/models/medicine.models';

@Component({
  selector: 'app-medicine-doctor-profile',
  standalone: true,
  imports: [CommonModule, AppFooterComponent, AppNavbarComponent, LucideAngularModule],
  templateUrl: './medicine-doctor-profile.component.html',
  styleUrl: './medicine-doctor-profile.component.scss',
})
export class MedicineDoctorProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly favoritesService = inject(FavoritesService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly navigationState = (history.state || {}) as { doctor?: DoctorProfile };

  protected readonly doctor =
    this.navigationState.doctor ||
    MEDICINE_DOCTORS.find((item) => item.id === this.route.snapshot.paramMap.get('id')) ||
    MEDICINE_DOCTORS[0];
  protected readonly coverUrl =
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1800&q=85';
  protected readonly mapUrl = computed<SafeResourceUrl>(() => {
    const src = `https://www.google.com/maps?q=${encodeURIComponent('Dakar, Senegal')}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });
  protected readonly isFavorite = computed(() => this.favoritesService.isFavorite(this.doctor.id));

  protected goBack(): void {
    this.location.back();
  }

  protected toggleFavorite(): void {
    const isAdded = this.favoritesService.toggle({
      id: this.doctor.id,
      name: this.doctor.name,
      subtitle: this.doctor.specialty,
      location: 'Dakar',
      imageUrl: this.doctor.imageUrl,
      route: `/medecine/${this.doctor.id}`,
      source: 'medicine',
    });

    this.feedback.success(isAdded ? 'Ajoute aux favoris.' : 'Retire des favoris.');
  }
}
