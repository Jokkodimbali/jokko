import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentView } from '../../../domain/appointments.models';

@Component({
  selector: 'app-appointment-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppNavbarComponent,
    LucideAngularModule,
    RouterLink,
  ],
  templateUrl: './appointment-detail-page.component.html',
  styleUrl: './appointment-detail-page.component.scss',
})
export class AppointmentDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);

  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly alertEnabled = signal(false);
  protected readonly statusLabel = computed(() => {
    const status = this.appointment()?.status;
    return status === 'ANNULEE' ? 'Rendez-vous annule' : 'Prestation prevus';
  });

  ngOnInit(): void {
    const appointmentId = this.route.snapshot.paramMap.get('id');
    if (!appointmentId) {
      this.router.navigate(['/appointments']);
      return;
    }

    this.loadAppointment(appointmentId);
  }

  protected goBack(): void {
    this.router.navigate(['/appointments']);
  }

  protected durationLabel(appointment: AppointmentView): string {
    return `${appointment.durationMinutes || 30} MIN`;
  }

  private loadAppointment(appointmentId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.appointmentsService.getAppointmentById(appointmentId).subscribe({
      next: (appointment) => {
        this.appointment.set(appointment);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger ce rendez-vous.');
        this.isLoading.set(false);
      },
    });
  }
}
