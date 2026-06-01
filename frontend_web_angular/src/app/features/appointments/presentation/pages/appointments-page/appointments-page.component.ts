import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentStatus, AppointmentView } from '../../../domain/appointments.models';

type AppointmentTab = 'future' | 'done';
type AppointmentStatusFilter = 'ALL' | 'EN_COURS' | 'CONFIRMEE' | 'URGENT' | 'ANNULEE';
type AppointmentTone = 'blue' | 'green' | 'red' | 'neutral';
type AppointmentPeriodFilter = 'ALL' | 'WEEK' | 'MONTH';

interface AppointmentGroup {
  key: string;
  label: string;
  count: number;
  items: AppointmentView[];
}

interface CalendarDay {
  day: number;
  isMuted: boolean;
  isToday: boolean;
  hasAppointments: boolean;
}

@Component({
  selector: 'app-appointments-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppFooterComponent,
    AppNavbarComponent,
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
  protected readonly activeTab = signal<AppointmentTab>('future');
  protected readonly activeStatus = signal<AppointmentStatusFilter>('ALL');
  protected readonly activePeriod = signal<AppointmentPeriodFilter>('ALL');
  protected readonly search = signal('');

  protected readonly futureAppointments = computed(() =>
    this.sortedAppointments(this.appointments().filter((appointment) => !this.isDone(appointment.status))),
  );

  protected readonly doneAppointments = computed(() =>
    this.sortedAppointments(this.appointments().filter((appointment) => this.isDone(appointment.status))),
  );

  protected readonly monthLabel = computed(() => {
    const reference = this.referenceDate();
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(reference);
  });

  protected readonly stats = computed(() => ({
    upcoming: this.futureAppointments().length,
    week: this.appointments().filter((appointment) => this.isThisWeek(appointment)).length,
    cancelled: this.appointments().filter((appointment) => appointment.status === 'ANNULEE').length,
  }));

  protected readonly statusOptions = computed(() => [
    {
      key: 'EN_COURS' as const,
      label: 'En cours',
      count: this.statusCount('EN_COURS'),
      icon: 'clock-3',
      tone: 'blue',
    },
    {
      key: 'CONFIRMEE' as const,
      label: 'Confirmes',
      count: this.statusCount('CONFIRMEE'),
      icon: 'check',
      tone: 'green',
    },
    {
      key: 'URGENT' as const,
      label: 'Urgents',
      count: this.statusCount('URGENT'),
      icon: 'triangle-alert',
      tone: 'red',
    },
    {
      key: 'ANNULEE' as const,
      label: 'Annules',
      count: this.statusCount('ANNULEE'),
      icon: 'circle-x',
      tone: 'neutral',
    },
  ]);

  protected readonly visibleAppointments = computed(() => {
    const source = this.activeTab() === 'future' ? this.futureAppointments() : this.doneAppointments();
    const status = this.activeStatus();
    const period = this.activePeriod();
    const term = this.search().trim().toLowerCase();

    return source.filter((appointment) => {
      const matchesStatus = status === 'ALL' || this.matchesStatus(appointment, status);
      const matchesPeriod = this.matchesPeriod(appointment, period);
      const matchesSearch =
        term.length === 0 ||
        [
          appointment.doctorName,
          appointment.specialty,
          appointment.serviceName,
          appointment.locationLabel,
          appointment.confirmationLabel,
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesPeriod && matchesSearch;
    });
  });

  protected readonly groupedAppointments = computed<AppointmentGroup[]>(() => {
    const groups = new Map<string, AppointmentView[]>();

    for (const appointment of this.visibleAppointments()) {
      const date = this.safeDate(appointment.scheduledAt);
      const key = Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), appointment]);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: key === 'unknown' ? 'Date a confirmer' : this.groupLabel(items[0]),
      count: items.length,
      items,
    }));
  });

  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const reference = this.referenceDate();
    const year = reference.getFullYear();
    const month = reference.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const today = new Date();
    const appointmentDays = new Set(
      this.appointments()
        .map((appointment) => this.safeDate(appointment.scheduledAt))
        .filter((date) => !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month)
        .map((date) => date.getDate()),
    );
    const days: CalendarDay[] = [];

    for (let i = 0; i < startOffset; i += 1) {
      days.push({ day: 0, isMuted: true, isToday: false, hasAppointments: false });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push({
        day,
        isMuted: false,
        isToday:
          today.getFullYear() === year &&
          today.getMonth() === month &&
          today.getDate() === day,
        hasAppointments: appointmentDays.has(day),
      });
    }

    return days;
  });

  protected readonly upcomingDates = computed(() =>
    this.futureAppointments()
      .reduce<{ key: string; label: string; count: number }[]>((dates, appointment) => {
        const date = this.safeDate(appointment.scheduledAt);
        if (Number.isNaN(date.getTime())) return dates;
        const key = date.toISOString().slice(0, 10);
        const existing = dates.find((item) => item.key === key);
        if (existing) {
          existing.count += 1;
        } else {
          dates.push({
            key,
            label: new Intl.DateTimeFormat('fr-FR', {
              day: 'numeric',
              month: 'long',
            }).format(date),
            count: 1,
          });
        }
        return dates;
      }, [])
      .slice(0, 5),
  );

  ngOnInit(): void {
    this.loadAppointments();
  }

  protected setTab(tab: AppointmentTab): void {
    this.activeTab.set(tab);
    this.activeStatus.set('ALL');
  }

  protected setSearch(value: string): void {
    this.search.set(value);
  }

  protected setStatusFilter(filter: AppointmentStatusFilter): void {
    this.activeStatus.set(this.activeStatus() === filter ? 'ALL' : filter);
  }

  protected setPeriodFilter(value: string): void {
    if (value === 'ALL' || value === 'WEEK' || value === 'MONTH') {
      this.activePeriod.set(value);
    }
  }

  protected rowTone(appointment: AppointmentView): AppointmentTone {
    if (this.matchesStatus(appointment, 'URGENT')) return 'red';
    if (appointment.status === 'TERMINEE' || appointment.status === 'CONFIRMEE') return 'green';
    if (appointment.status === 'EN_ATTENTE' || appointment.status === 'ANNULEE' || appointment.status === 'NO_SHOW') {
      return 'neutral';
    }
    return 'blue';
  }

  protected statusLabel(appointment: AppointmentView): string {
    if (this.matchesStatus(appointment, 'URGENT')) return 'Urgent';

    const labels: Record<AppointmentStatus, string> = {
      EN_ATTENTE: 'En attente',
      CONFIRMEE: 'Confirme',
      PAYEE_SEQUESTRE: 'En cours',
      EN_COURS: 'En cours',
      TERMINEE: 'Confirme',
      ANNULEE: 'Annule',
      NO_SHOW: 'Absent',
      LITIGE: 'Urgent',
    };

    return labels[appointment.status];
  }

  protected statusPanelTitle(appointment: AppointmentView): string {
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'Demande en cours';
    if (appointment.status === 'TERMINEE') return 'Prestation terminee';
    if (appointment.status === 'EN_COURS' || appointment.status === 'PAYEE_SEQUESTRE') {
      return 'Prestation en cours';
    }
    if (appointment.status === 'ANNULEE' || appointment.status === 'NO_SHOW') return 'Rendez-vous annule';
    return 'Prestation prevue';
  }

  protected statusPanelMessage(appointment: AppointmentView): string {
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') {
      const amount = appointment.proposedAdjustedPrice
        ? `${this.formatAmount(appointment.proposedAdjustedPrice)} FCFA`
        : 'montant a confirmer';
      return `${appointment.doctorName} propose un ajustement tarifaire de ${amount}`;
    }

    if (appointment.status === 'TERMINEE') {
      return appointment.clientRating
        ? `Evaluation client : ${appointment.clientRating}/5`
        : 'La prestation est terminee et archivee dans votre dossier';
    }

    if (appointment.status === 'EN_COURS') {
      return `${appointment.doctorName} travaille sur votre prestation`;
    }

    return appointment.confirmationLabel;
  }

  protected progressValue(appointment: AppointmentView): number {
    if (appointment.status === 'TERMINEE') return 100;
    if (appointment.status === 'EN_COURS') return 65;
    if (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'CONFIRMEE') return 43;
    if (appointment.status === 'EN_ATTENTE') return 15;
    return 0;
  }

  protected canCancel(appointment: AppointmentView): boolean {
    return !this.isDone(appointment.status) && appointment.status !== 'EN_COURS';
  }

  protected cancelAppointment(appointment: AppointmentView, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.canCancel(appointment)) return;

    this.appointmentsService.cancelAppointment(appointment.id).subscribe({
      next: (updated) => {
        this.appointments.update((appointments) =>
          appointments.map((item) => (item.id === appointment.id ? updated : item)),
        );
      },
    });
  }

  protected dayName(appointment: AppointmentView): string {
    const date = this.safeDate(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date).replace('.', '').toUpperCase();
  }

  protected dayNumber(appointment: AppointmentView): string {
    const date = this.safeDate(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) return '--';
    return String(date.getDate()).padStart(2, '0');
  }

  protected monthShort(appointment: AppointmentView): string {
    const date = this.safeDate(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '');
  }

  protected formatAmount(value: number | null): string {
    if (value === null) return 'Montant a confirmer';
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  protected avatarInitials(appointment: AppointmentView): string {
    return appointment.doctorName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  private loadAppointments(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      this.isLoading.set(false);
      return;
    }

    const scope = this.resolveReservationScope();
    if (!scope) {
      this.appointments.set([]);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.appointmentsService.listMyAppointments(scope).subscribe({
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

  private resolveReservationScope(): 'CLIENT' | 'PRESTATAIRE' | null {
    const role = this.authSession.getAuthenticatedRole();
    if (role === 'CLIENT') return 'CLIENT';
    if (role === 'PRESTATAIRE' || role === 'MEDECIN') return 'PRESTATAIRE';
    return null;
  }

  private matchesStatus(appointment: AppointmentView, filter: AppointmentStatusFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'URGENT') {
      return appointment.status === 'LITIGE' || appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT';
    }
    if (filter === 'CONFIRMEE') {
      return appointment.status === 'CONFIRMEE' || appointment.status === 'TERMINEE';
    }
    return appointment.status === filter;
  }

  private matchesPeriod(appointment: AppointmentView, filter: AppointmentPeriodFilter): boolean {
    if (filter === 'ALL') return true;

    const date = this.safeDate(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'WEEK') {
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return date >= start && date < end;
    }

    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  private statusCount(filter: AppointmentStatusFilter): number {
    const source = this.activeTab() === 'future' ? this.futureAppointments() : this.doneAppointments();
    const period = this.activePeriod();
    const term = this.search().trim().toLowerCase();

    return source.filter((appointment) => {
      const matchesSearch =
        term.length === 0 ||
        [
          appointment.doctorName,
          appointment.specialty,
          appointment.serviceName,
          appointment.locationLabel,
          appointment.confirmationLabel,
        ].some((value) => value.toLowerCase().includes(term));

      return this.matchesStatus(appointment, filter) && this.matchesPeriod(appointment, period) && matchesSearch;
    }).length;
  }

  private isDone(status: AppointmentStatus): boolean {
    return status === 'TERMINEE' || status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private isThisWeek(appointment: AppointmentView): boolean {
    const rawDate = this.safeDate(appointment.scheduledAt);
    if (Number.isNaN(rawDate.getTime())) return false;

    const now = new Date();
    const diffMs = rawDate.getTime() - now.getTime();
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  private sortedAppointments(appointments: AppointmentView[]): AppointmentView[] {
    return [...appointments].sort(
      (a, b) => this.safeDate(a.scheduledAt).getTime() - this.safeDate(b.scheduledAt).getTime(),
    );
  }

  private referenceDate(): Date {
    const first = this.futureAppointments()[0] ?? this.appointments()[0];
    const date = first ? this.safeDate(first.scheduledAt) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private groupLabel(appointment: AppointmentView): string {
    const date = this.safeDate(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) return 'Date a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date).toUpperCase();
  }

  private safeDate(value: string): Date {
    return new Date(value);
  }
}
