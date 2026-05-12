import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentStat, AppointmentView } from '../../../domain/appointments.models';
import { AppointmentCardComponent } from '../../components/appointment-card/appointment-card.component';
import { AppointmentStatsComponent } from '../../components/appointment-stats/appointment-stats.component';
import { AppointmentToolbarComponent } from '../../components/appointment-toolbar/appointment-toolbar.component';

@Component({
  selector: 'app-appointments-page',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppNavbarComponent,
    AppointmentCardComponent,
    AppointmentStatsComponent,
    AppointmentToolbarComponent,
    LucideAngularModule,
  ],
  templateUrl: './appointments-page.component.html',
  styleUrl: './appointments-page.component.scss',
})
export class AppointmentsPageComponent implements OnInit {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly authSession = inject(AuthSessionService);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointments = signal<AppointmentView[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly activeTab = signal<'future' | 'done'>('future');
  protected readonly search = signal('');

  protected readonly futureAppointments = computed(() =>
    this.appointments().filter((appointment) => !this.isDone(appointment.status)),
  );
  protected readonly doneAppointments = computed(() =>
    this.appointments().filter((appointment) => this.isDone(appointment.status)),
  );
  protected readonly stats = computed<AppointmentStat[]>(() => [
    {
      label: 'A venir',
      value: this.futureAppointments().length,
      caption: 'Rendez-vous',
    },
    {
      label: 'Cette semaine',
      value: this.appointments().filter((appointment) => this.isThisWeek(appointment)).length,
      caption: 'Consultation',
    },
    {
      label: 'Annule',
      value: this.appointments().filter((appointment) => appointment.status === 'ANNULEE').length,
      caption: 'Ce mois',
    },
  ]);
  protected readonly visibleAppointments = computed(() => {
    const source = this.activeTab() === 'future' ? this.futureAppointments() : this.doneAppointments();
    const term = this.search().trim().toLowerCase();

    if (!term) return source;

    return source.filter((appointment) =>
      [
        appointment.doctorName,
        appointment.specialty,
        appointment.serviceName,
        appointment.locationLabel,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  });

  ngOnInit(): void {
    this.loadAppointments();
  }

  protected setTab(tab: 'future' | 'done'): void {
    this.activeTab.set(tab);
  }

  protected setSearch(value: string): void {
    this.search.set(value);
  }

  private loadAppointments(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.appointmentsService.listMyAppointments().subscribe({
      next: (appointments) => {
        this.appointments.set(appointments);
        this.isLoading.set(false);
      },
      error: () => {
        this.appointments.set([]);
        this.isLoading.set(false);
      },
    });
  }

  private isDone(status: AppointmentView['status']): boolean {
    return status === 'TERMINEE' || status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private isThisWeek(appointment: AppointmentView): boolean {
    const rawDate = new Date(appointment.scheduledAt);
    if (Number.isNaN(rawDate.getTime())) return false;

    const now = new Date();
    const diffMs = rawDate.getTime() - now.getTime();
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }
}
