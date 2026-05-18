import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { FavoritesService } from '../../../../../core/favorites/favorites.service';
import { DoctorProfile } from '../../../domain/models/medicine.models';
import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';

@Component({
  selector: 'app-doctor-card',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './doctor-card.component.html',
  styleUrl: './doctor-card.component.scss',
})
export class DoctorCardComponent {
  private readonly router = inject(Router);
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);

  @Input({ required: true }) doctor!: DoctorProfile;

  protected readonly messages = MEDICINE_UI_MESSAGES;
  protected readonly isTogglingFavorite = signal(false);
  protected readonly isFavorite = computed(() =>
    this.favoritesService
      .favorites()
      .some((favorite) => favorite.professionalId === this.doctor?.id),
  );

  protected openBooking(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/medecine', this.doctor.id, 'rendez-vous'], {
      state: { doctor: this.doctor },
    });
  }

  protected toggleFavorite(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.success('Connectez-vous pour gerer vos favoris.');
      return;
    }

    if (this.isTogglingFavorite()) return;

    const wasFavorite = this.isFavorite();
    this.isTogglingFavorite.set(true);

    const subscription = {
      next: () => {
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
      this.favoritesService.remove(this.doctor.id).subscribe(subscription);
      return;
    }

    this.favoritesService.add(this.doctor.id).subscribe(subscription);
  }
}
