import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentStatus, AppointmentView } from '../../../domain/appointments.models';
import {
  NegotiationStatus,
  NegotiationView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';

type AppointmentTab = 'appointments' | 'negotiations';
type AppointmentStatusFilter = 'ALL' | AppointmentStatus | NegotiationStatus;
type AppointmentTone = 'blue' | 'green' | 'red' | 'neutral';
type AppointmentPeriodFilter = 'ALL' | 'WEEK' | 'MONTH';

interface AppointmentGroup {
  key: string;
  label: string;
  count: number;
  items: AppointmentView[];
}

interface NegotiationGroup {
  key: string;
  label: string;
  count: number;
  items: NegotiationView[];
}

interface CalendarDay {
  day: number;
  dateKey: string | null;
  isMuted: boolean;
  isToday: boolean;
  hasAppointments: boolean;
  appointmentCount: number;
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
export class AppointmentsPageComponent implements OnInit, OnDestroy {
  private readonly negotiationRefreshMs = 5000;
  private negotiationRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly serviceProposalService = inject(ServiceProposalService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointments = signal<AppointmentView[]>([]);
  protected readonly negotiations = signal<NegotiationView[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadErrorMessage = signal<string | null>(null);
  protected readonly activeTab = signal<AppointmentTab>('appointments');
  protected readonly activeStatus = signal<AppointmentStatusFilter>('ALL');
  protected readonly activePeriod = signal<AppointmentPeriodFilter>('ALL');
  protected readonly search = signal('');
  protected readonly selectedCalendarDate = signal<string | null>(null);
  protected readonly cancellationMessage = signal<string | null>(null);
  protected readonly cancellationMessageTone = signal<'success' | 'error'>('success');
  protected readonly cancellingAppointmentId = signal<string | null>(null);

  protected readonly sortedAppointmentList = computed(() =>
    this.sortedAppointments(this.appointments()),
  );

  protected readonly sortedNegotiationList = computed(() =>
    [...this.negotiations()].sort(
      (left, right) => this.negotiationDate(right).getTime() - this.negotiationDate(left).getTime(),
    ),
  );

  protected readonly totalItems = computed(
    () => this.appointments().length + this.negotiations().length,
  );

  protected readonly monthLabel = computed(() => {
    const reference = this.referenceDate();
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(reference);
  });

  protected readonly stats = computed(() => ({
    upcoming: this.appointments().filter((appointment) => this.isFutureAppointment(appointment)).length,
    week: this.appointments().filter((appointment) => this.isThisWeek(appointment)).length,
    negotiating: this.negotiations().filter((negotiation) => this.isActiveNegotiation(negotiation)).length,
  }));

  protected readonly statusOptions = computed(() => {
    const options = this.activeTab() === 'appointments'
      ? [
          { key: 'EN_ATTENTE' as const, label: 'En attente', icon: 'clock-3', tone: 'blue' },
          { key: 'CONFIRMEE' as const, label: 'Confirmes', icon: 'check', tone: 'green' },
          { key: 'PAYEE_SEQUESTRE' as const, label: 'Payes', icon: 'shield-check', tone: 'green' },
          { key: 'EN_COURS' as const, label: 'En cours', icon: 'activity', tone: 'blue' },
          { key: 'TERMINEE' as const, label: 'Termines', icon: 'circle-check', tone: 'green' },
          { key: 'ANNULEE' as const, label: 'Annules', icon: 'circle-x', tone: 'neutral' },
          { key: 'NO_SHOW' as const, label: 'Absents', icon: 'user-x', tone: 'neutral' },
          { key: 'LITIGE' as const, label: 'Litiges', icon: 'triangle-alert', tone: 'red' },
        ]
      : [
          { key: 'EN_ATTENTE_PRESTATAIRE' as const, label: 'Attente prestataire', icon: 'clock-3', tone: 'blue' },
          { key: 'EN_ATTENTE_CLIENT' as const, label: 'Attente client', icon: 'clock-3', tone: 'blue' },
          { key: 'ACCEPTEE' as const, label: 'Acceptees', icon: 'check', tone: 'green' },
          { key: 'CONVERTIE_EN_RESERVATION' as const, label: 'Converties', icon: 'calendar-check', tone: 'green' },
          { key: 'REFUSEE' as const, label: 'Refusees', icon: 'circle-x', tone: 'red' },
          { key: 'ANNULEE' as const, label: 'Annulees', icon: 'ban', tone: 'neutral' },
        ];

    return options.map((option) => ({
      ...option,
      count: this.statusCount(option.key),
    }));
  });

  protected readonly visibleAppointments = computed(() => {
    const status = this.activeStatus();
    const period = this.activePeriod();
    const selectedDate = this.selectedCalendarDate();
    const term = this.search().trim().toLowerCase();

    return this.sortedAppointmentList().filter((appointment) => {
      const matchesStatus = status === 'ALL' || appointment.status === status;
      const matchesPeriod = this.matchesPeriod(appointment, period);
      const matchesCalendarDate = !selectedDate || this.appointmentDateKey(appointment) === selectedDate;
      const matchesSearch =
        term.length === 0 ||
        [
          appointment.doctorName,
          appointment.specialty,
          appointment.serviceName,
          appointment.locationLabel,
          appointment.confirmationLabel,
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesPeriod && matchesCalendarDate && matchesSearch;
    });
  });

  protected readonly visibleNegotiations = computed(() => {
    const status = this.activeStatus();
    const period = this.activePeriod();
    const selectedDate = this.selectedCalendarDate();
    const term = this.search().trim().toLowerCase();

    return this.sortedNegotiationList().filter((negotiation) => {
      const date = this.negotiationDate(negotiation);
      const matchesStatus = status === 'ALL' || negotiation.statut === status;
      const matchesPeriod = this.matchesDatePeriod(date, period);
      const matchesCalendarDate = !selectedDate || this.dateKey(date) === selectedDate;
      const matchesSearch =
        term.length === 0 ||
        [
          this.negotiationContactName(negotiation),
          negotiation.service?.nom ?? '',
          negotiation.adresseClientProposee ?? '',
          negotiation.messageCourant ?? '',
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesPeriod && matchesCalendarDate && matchesSearch;
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

  protected readonly groupedNegotiations = computed<NegotiationGroup[]>(() => {
    const groups = new Map<string, NegotiationView[]>();

    for (const negotiation of this.visibleNegotiations()) {
      const date = this.negotiationDate(negotiation);
      const key = this.dateKey(date);
      groups.set(key, [...(groups.get(key) ?? []), negotiation]);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: this.formatGroupDate(this.negotiationDate(items[0])),
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
    const activeDates = this.activeTab() === 'appointments'
      ? this.appointments().map((appointment) => this.safeDate(appointment.scheduledAt))
      : this.negotiations().map((negotiation) => this.negotiationDate(negotiation));
    const appointmentCounts = activeDates
      .filter((date) => !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month)
      .reduce((counts, date) => {
        const key = this.dateKey(date);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return counts;
      }, new Map<string, number>());
    const appointmentDays = new Set(
      activeDates
        .filter((date) => !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month)
        .map((date) => date.getDate()),
    );
    const days: CalendarDay[] = [];

    for (let i = 0; i < startOffset; i += 1) {
      days.push({
        day: 0,
        dateKey: null,
        isMuted: true,
        isToday: false,
        hasAppointments: false,
        appointmentCount: 0,
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day);
      const dateKey = this.dateKey(date);
      days.push({
        day,
        dateKey,
        isMuted: false,
        isToday:
          today.getFullYear() === year &&
          today.getMonth() === month &&
          today.getDate() === day,
        hasAppointments: appointmentDays.has(day),
        appointmentCount: appointmentCounts.get(dateKey) ?? 0,
      });
    }

    return days;
  });

  protected readonly selectedCalendarDateLabel = computed(() => {
    const selectedDate = this.selectedCalendarDate();
    if (!selectedDate) return null;
    return this.formatDateKey(selectedDate);
  });

  protected readonly selectedCalendarAppointmentCount = computed(() => {
    const selectedDate = this.selectedCalendarDate();
    if (!selectedDate) return 0;
    return this.activeTab() === 'appointments'
      ? this.appointments().filter((appointment) => this.appointmentDateKey(appointment) === selectedDate).length
      : this.negotiations().filter((negotiation) => this.dateKey(this.negotiationDate(negotiation)) === selectedDate).length;
  });

  protected readonly calendarFilterMessage = computed(() => {
    const label = this.selectedCalendarDateLabel();
    if (!label) return 'Cliquez sur une date du calendrier pour filtrer vos rendez-vous.';

    const total = this.selectedCalendarAppointmentCount();
    if (total === 0) {
      return `Aucun element trouve pour le ${label}.`;
    }

    return `${total} element${total > 1 ? 's' : ''} trouve${total > 1 ? 's' : ''} pour le ${label}.`;
  });

  protected readonly upcomingDates = computed(() =>
    this.appointments()
      .filter((appointment) => this.isFutureAppointment(appointment))
      .sort((left, right) => this.safeDate(left.scheduledAt).getTime() - this.safeDate(right.scheduledAt).getTime())
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

  ngOnDestroy(): void {
    if (this.negotiationRefreshIntervalId) {
      clearInterval(this.negotiationRefreshIntervalId);
    }
  }

  protected setTab(tab: AppointmentTab): void {
    this.activeTab.set(tab);
    this.activeStatus.set('ALL');
    this.selectedCalendarDate.set(null);
    if (tab === 'negotiations') {
      this.refreshNegotiations();
    }
  }

  protected setSearch(value: string): void {
    this.search.set(value);
  }

  protected setSearchFromEvent(event: Event): void {
    this.setSearch((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected setStatusFilter(filter: AppointmentStatusFilter): void {
    this.activeStatus.set(this.activeStatus() === filter ? 'ALL' : filter);
  }

  protected setPeriodFilter(value: string): void {
    if (value === 'ALL' || value === 'WEEK' || value === 'MONTH') {
      this.activePeriod.set(value);
    }
  }

  protected setPeriodFilterFromEvent(event: Event): void {
    this.setPeriodFilter((event.target as HTMLSelectElement | null)?.value ?? '');
  }

  protected selectCalendarDay(day: CalendarDay): void {
    if (!day.dateKey) return;
    this.selectCalendarDateKey(day.dateKey);
  }

  protected selectCalendarDateKey(dateKey: string): void {
    this.selectedCalendarDate.set(this.selectedCalendarDate() === dateKey ? null : dateKey);
  }

  protected clearCalendarFilter(): void {
    this.selectedCalendarDate.set(null);
  }

  protected rowTone(appointment: AppointmentView): AppointmentTone {
    if (this.isOverdueAppointment(appointment)) return 'neutral';
    if (appointment.status === 'LITIGE' || appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'red';
    if (appointment.status === 'TERMINEE' || appointment.status === 'CONFIRMEE') return 'green';
    if (appointment.status === 'EN_ATTENTE' || appointment.status === 'ANNULEE' || appointment.status === 'NO_SHOW') {
      return 'neutral';
    }
    return 'blue';
  }

  protected statusLabel(appointment: AppointmentView): string {
    if (this.isOverdueAppointment(appointment)) return 'A cloturer';
    if (appointment.status === 'LITIGE' || appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'Urgent';

    const labels: Record<AppointmentStatus, string> = {
      EN_ATTENTE: 'En attente',
      CONFIRMEE: 'Confirme',
      PAYEE_SEQUESTRE: 'En cours',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminee',
      ANNULEE: 'Annule',
      NO_SHOW: 'Absent',
      LITIGE: 'Urgent',
    };

    return labels[appointment.status];
  }

  protected statusPanelTitle(appointment: AppointmentView): string {
    if (this.isOverdueAppointment(appointment)) return 'Rendez-vous a cloturer';
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'Demande en cours';
    if (appointment.status === 'TERMINEE') return 'Prestation terminee';
    if (appointment.status === 'EN_COURS' || appointment.status === 'PAYEE_SEQUESTRE') {
      return 'Prestation en cours';
    }
    if (appointment.status === 'ANNULEE') return 'Rendez-vous annule';
    if (appointment.status === 'NO_SHOW') return 'Rendez-vous non honore';
    return 'Prestation prevue';
  }

  protected statusPanelMessage(appointment: AppointmentView): string {
    if (this.isOverdueAppointment(appointment)) {
      return 'La date prevue est passee, mais la prestation ne sera terminee que lorsque le prestataire la marquera comme terminee.';
    }

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
    if (this.isOverdueAppointment(appointment)) return 0;
    if (appointment.status === 'TERMINEE') return 100;
    if (appointment.status === 'EN_COURS') return 65;
    if (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'CONFIRMEE') return 43;
    if (appointment.status === 'EN_ATTENTE') return 15;
    return 0;
  }

  protected canCancel(appointment: AppointmentView): boolean {
    return this.hasCancellableStatus(appointment.status) && this.isMoreThanHoursBefore(appointment.scheduledAt, 24);
  }

  protected primaryActionLabel(appointment: AppointmentView): string {
    if (this.canProviderCloseAppointment(appointment)) return 'Cloturer';
    if (this.shouldPayAppointment(appointment)) return 'Payer';
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'Repondre';
    if (appointment.status === 'EN_ATTENTE') return 'Finaliser';
    return 'Voir';
  }

  protected primaryActionIcon(appointment: AppointmentView): string {
    if (this.canProviderCloseAppointment(appointment)) return 'check';
    if (this.shouldPayAppointment(appointment)) return 'arrow-right';
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'send';
    return 'arrow-right';
  }

  protected primaryActionRoute(appointment: AppointmentView): string[] {
    return this.shouldPayAppointment(appointment)
      ? ['/appointments', appointment.id, 'payment']
      : ['/appointments', appointment.id];
  }

  protected primaryActionQueryParams(): { returnUrl: string } {
    return { returnUrl: this.router.url || '/appointments' };
  }

  protected cancellationDisabledReason(appointment: AppointmentView): string {
    if (!this.hasCancellableStatus(appointment.status)) {
      return 'Ce rendez-vous est deja cloture ou son statut ne permet plus une annulation.';
    }

    if (!this.isMoreThanHoursBefore(appointment.scheduledAt, 24)) {
      return 'Annulation indisponible : le rendez-vous doit etre annule plus de 24h avant l horaire prevu.';
    }

    return 'Annuler ce rendez-vous.';
  }

  protected cancelAppointment(appointment: AppointmentView, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.canCancel(appointment)) {
      this.showCancellationMessage(this.cancellationDisabledReason(appointment), 'error');
      return;
    }

    this.cancellingAppointmentId.set(appointment.id);
    this.cancellationMessage.set(null);

    this.appointmentsService.cancelAppointment(
      appointment.id,
      'Annulation demandee depuis la page rendez-vous.',
    ).subscribe({
      next: (updated) => {
        this.appointments.update((appointments) =>
          appointments.map((item) => (item.id === appointment.id ? updated : item)),
        );
        this.cancellingAppointmentId.set(null);
        this.showCancellationMessage('Reservation annulee avec succes.', 'success');
      },
      error: (error) => {
        this.cancellingAppointmentId.set(null);
        this.showCancellationMessage(
          getHttpErrorMessage(error, "Impossible d'annuler cette reservation. Verifiez le statut et le delai de 24h."),
          'error',
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
    return new Intl.NumberFormat('fr-FR').format(value).replace(/\s/g, ' ');
  }

  protected avatarInitials(appointment: AppointmentView): string {
    return appointment.doctorName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected negotiationContactName(negotiation: NegotiationView): string {
    if (this.currentUser()?.role === 'CLIENT') {
      return negotiation.professionnel?.nomEntreprise
        || negotiation.professionnel?.utilisateur.nom
        || 'Prestataire';
    }
    return negotiation.client?.nom || 'Client';
  }

  protected negotiationInitials(negotiation: NegotiationView): string {
    return this.negotiationContactName(negotiation)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected negotiationAvatarUrl(negotiation: NegotiationView): string | null {
    if (this.currentUser()?.role === 'CLIENT') {
      return negotiation.professionnel?.utilisateur.urlAvatar || null;
    }
    return negotiation.client?.urlAvatar || null;
  }

  protected negotiationBannerLabel(negotiation: NegotiationView): string {
    const contact = this.negotiationContactName(negotiation).split(' ')[0] || 'Votre interlocuteur';
    if (negotiation.statut === 'EN_ATTENTE_CLIENT') return `${contact} propose un nouveau prix`;
    if (negotiation.statut === 'EN_ATTENTE_PRESTATAIRE') return 'Vous proposez un nouveau prix';
    if (negotiation.statut === 'ACCEPTEE') return 'Le prix a ete accepte';
    if (negotiation.statut === 'CONVERTIE_EN_RESERVATION') return 'Le rendez-vous est confirme';
    if (negotiation.statut === 'REFUSEE') return 'La proposition a ete refusee';
    return 'La negociation a ete annulee';
  }

  protected negotiationPreviousAmount(negotiation: NegotiationView): number {
    const offers = negotiation.propositions ?? [];
    return offers.length > 1
      ? Number(offers[offers.length - 2]?.montant || negotiation.montantInitial)
      : Number(negotiation.montantInitial);
  }

  protected negotiationCurrentOfferLabel(negotiation: NegotiationView): string {
    const contact = this.negotiationContactName(negotiation).split(' ')[0] || 'interlocuteur';
    const currentActorIsUser = this.isCurrentNegotiationActor(negotiation.dernierProposePar);
    return currentActorIsUser ? 'Votre offre' : `Offre ${contact}`;
  }

  protected negotiationPreviousOfferLabel(negotiation: NegotiationView): string {
    const contact = this.negotiationContactName(negotiation).split(' ')[0] || 'interlocuteur';
    const currentActorIsUser = this.isCurrentNegotiationActor(negotiation.dernierProposePar);
    return currentActorIsUser ? `Offre ${contact}` : 'Votre offre';
  }

  protected negotiationPriceDifference(negotiation: NegotiationView): number {
    return Number(negotiation.montantCourant) - this.negotiationPreviousAmount(negotiation);
  }

  protected negotiationDifferenceLabel(negotiation: NegotiationView): string {
    const difference = this.negotiationPriceDifference(negotiation);
    const amount = this.formatAmount(Math.abs(difference));
    if (difference === 0) return 'Le prix propose est identique a votre offre';
    return `${difference > 0 ? '+' : '-'} ${amount} FCFA de ${difference > 0 ? 'plus' : 'moins'} que votre offre`;
  }

  protected hasNegotiationPriceComparison(negotiation: NegotiationView): boolean {
    return (
      (negotiation.propositions?.length ?? 0) > 1 &&
      (negotiation.statut === 'EN_ATTENTE_CLIENT' || negotiation.statut === 'EN_ATTENTE_PRESTATAIRE')
    );
  }

  protected negotiationStatusLabel(negotiation: NegotiationView): string {
    const labels: Record<NegotiationStatus, string> = {
      EN_ATTENTE_PRESTATAIRE: 'Attente prestataire',
      EN_ATTENTE_CLIENT: 'Attente client',
      ACCEPTEE: 'Acceptee',
      REFUSEE: 'Refusee',
      ANNULEE: 'Annulee',
      CONVERTIE_EN_RESERVATION: 'Convertie en RDV',
    };
    return labels[negotiation.statut];
  }

  protected negotiationTone(negotiation: NegotiationView): AppointmentTone {
    if (negotiation.statut === 'ACCEPTEE' || negotiation.statut === 'CONVERTIE_EN_RESERVATION') return 'green';
    if (negotiation.statut === 'REFUSEE') return 'red';
    if (negotiation.statut === 'ANNULEE') return 'neutral';
    return 'blue';
  }

  protected negotiationRoute(negotiation: NegotiationView): string[] {
    if (negotiation.reservationId) {
      return ['/appointments', negotiation.reservationId];
    }
    return ['/services', negotiation.professionnelId, 'proposition'];
  }

  protected negotiationQueryParams(negotiation: NegotiationView): Record<string, string> {
    if (negotiation.reservationId) {
      return { returnUrl: this.router.url || '/appointments' };
    }
    return {
      serviceId: negotiation.serviceId,
      negotiationId: negotiation.id,
      returnUrl: this.router.url || '/appointments',
    };
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
    this.loadErrorMessage.set(null);
    forkJoin({
      appointments: this.appointmentsService.listMyAppointments(scope),
      negotiations: this.serviceProposalService.listMyPriceProposals(scope),
    }).subscribe({
      next: ({ appointments, negotiations }) => {
        this.appointments.set(appointments);
        this.negotiations.set(negotiations);
        this.isLoading.set(false);
        this.startNegotiationRefresh(scope);
      },
      error: () => {
        this.appointments.set([]);
        this.negotiations.set([]);
        this.loadErrorMessage.set('Impossible de charger vos rendez-vous et negociations pour le moment.');
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

  private matchesPeriod(appointment: AppointmentView, filter: AppointmentPeriodFilter): boolean {
    const date = this.safeDate(appointment.scheduledAt);
    return this.matchesDatePeriod(date, filter);
  }

  private startNegotiationRefresh(scope: 'CLIENT' | 'PRESTATAIRE'): void {
    if (this.negotiationRefreshIntervalId) {
      clearInterval(this.negotiationRefreshIntervalId);
    }

    this.negotiationRefreshIntervalId = setInterval(() => {
      if (this.activeTab() !== 'negotiations' || document.hidden) return;
      this.refreshNegotiations(scope);
    }, this.negotiationRefreshMs);
  }

  private refreshNegotiations(scope = this.resolveReservationScope()): void {
    if (!scope) return;
    this.serviceProposalService.listMyPriceProposals(scope, true).subscribe({
      next: (negotiations) => this.negotiations.set(negotiations),
    });
  }

  private isCurrentNegotiationActor(actor: 'CLIENT' | 'PRESTATAIRE'): boolean {
    return this.currentUser()?.role === 'CLIENT' ? actor === 'CLIENT' : actor === 'PRESTATAIRE';
  }

  private matchesDatePeriod(date: Date, filter: AppointmentPeriodFilter): boolean {
    if (filter === 'ALL') return true;
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
    const period = this.activePeriod();
    const selectedDate = this.selectedCalendarDate();
    const term = this.search().trim().toLowerCase();

    if (this.activeTab() === 'negotiations') {
      return this.negotiations().filter((negotiation) => {
        const matchesCalendarDate =
          !selectedDate || this.dateKey(this.negotiationDate(negotiation)) === selectedDate;
        const matchesSearch =
          term.length === 0 ||
          [
            this.negotiationContactName(negotiation),
            negotiation.service?.nom ?? '',
            negotiation.adresseClientProposee ?? '',
          ].some((value) => value.toLowerCase().includes(term));

        return (
          negotiation.statut === filter &&
          this.matchesDatePeriod(this.negotiationDate(negotiation), period) &&
          matchesCalendarDate &&
          matchesSearch
        );
      }).length;
    }

    return this.appointments().filter((appointment) => {
      const matchesCalendarDate = !selectedDate || this.appointmentDateKey(appointment) === selectedDate;
      const matchesSearch =
        term.length === 0 ||
        [
          appointment.doctorName,
          appointment.specialty,
          appointment.serviceName,
          appointment.locationLabel,
          appointment.confirmationLabel,
        ].some((value) => value.toLowerCase().includes(term));

      return (
        appointment.status === filter &&
        this.matchesPeriod(appointment, period) &&
        matchesCalendarDate &&
        matchesSearch
      );
    }).length;
  }

  private isDone(status: AppointmentStatus): boolean {
    return status === 'TERMINEE' || status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private isFutureAppointment(appointment: AppointmentView): boolean {
    if (this.isDone(appointment.status) || appointment.status === 'LITIGE') return false;
    return !this.isPastAppointment(appointment);
  }

  private isOverdueAppointment(appointment: AppointmentView): boolean {
    return !this.isDone(appointment.status) && appointment.status !== 'LITIGE' && this.isPastAppointment(appointment);
  }

  private isPastAppointment(appointment: AppointmentView): boolean {
    const date = this.safeDate(appointment.scheduledAt);
    return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
  }

  private hasCancellableStatus(status: AppointmentStatus): boolean {
    return (
      status === 'EN_ATTENTE' ||
      status === 'CONFIRMEE' ||
      status === 'PAYEE_SEQUESTRE' ||
      status === 'EN_COURS'
    );
  }

  private shouldPayAppointment(appointment: AppointmentView): boolean {
    return (
      !!appointment.agreedPrice &&
      appointment.agreedPrice > 0 &&
      (appointment.status === 'EN_ATTENTE' || appointment.status === 'CONFIRMEE')
    );
  }

  private canProviderCloseAppointment(appointment: AppointmentView): boolean {
    const role = this.currentUser()?.role;
    return (
      (role === 'PRESTATAIRE' || role === 'MEDECIN') &&
      this.isOverdueAppointment(appointment) &&
      (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'EN_COURS')
    );
  }

  private isMoreThanHoursBefore(value: string, hours: number): boolean {
    const date = this.safeDate(value);
    if (Number.isNaN(date.getTime())) return false;

    const threshold = date.getTime() - hours * 60 * 60 * 1000;
    return Date.now() < threshold;
  }

  private showCancellationMessage(message: string, tone: 'success' | 'error'): void {
    this.cancellationMessageTone.set(tone);
    this.cancellationMessage.set(message);
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
    const date = this.activeTab() === 'appointments'
      ? this.safeDate(this.appointments()[0]?.scheduledAt ?? '')
      : this.negotiationDate(this.negotiations()[0]);
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

  private appointmentDateKey(appointment: AppointmentView): string | null {
    const date = this.safeDate(appointment.scheduledAt);
    return Number.isNaN(date.getTime()) ? null : this.dateKey(date);
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateKey(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private safeDate(value: string): Date {
    return new Date(value);
  }

  protected negotiationDate(negotiation?: NegotiationView): Date {
    if (!negotiation) return new Date(Number.NaN);
    return this.safeDate(negotiation.dateHeureProposee || negotiation.misAJourLe || negotiation.creeLe);
  }

  private formatGroupDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date).toUpperCase();
  }

  private isActiveNegotiation(negotiation: NegotiationView): boolean {
    return negotiation.statut === 'EN_ATTENTE_CLIENT' || negotiation.statut === 'EN_ATTENTE_PRESTATAIRE';
  }
}
