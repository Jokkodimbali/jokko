import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { MEDICINE_DOCTORS } from '../../../domain/medicine.mock';
import { DoctorProfile } from '../../../domain/models/medicine.models';

@Component({
  selector: 'app-medicine-doctor-profile',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppNavbarComponent,
    AppScrollHintComponent,
    LucideAngularModule,
  ],
  templateUrl: './medicine-doctor-profile.component.html',
  styleUrl: './medicine-doctor-profile.component.scss',
})
export class MedicineDoctorProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly feedback = inject(AppFeedbackService);
  private readonly navigationState = (history.state || {}) as { doctor?: DoctorProfile };

  protected readonly doctor =
    this.navigationState.doctor ||
    MEDICINE_DOCTORS.find((item) => item.id === this.route.snapshot.paramMap.get('id')) ||
    MEDICINE_DOCTORS[0];
  protected readonly coverUrl = '/boabab.png';
  protected readonly mapUrl = computed<SafeResourceUrl>(() => {
    const src = `https://www.google.com/maps?q=${encodeURIComponent('Dakar, Senegal')}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  });
  protected readonly isFavorite = signal(false);

  protected goBack(): void {
    this.location.back();
  }

  protected toggleFavorite(): void {
    this.feedback.success('Les favoris medecine seront synchronises avec le backend sante.');
  }
}
