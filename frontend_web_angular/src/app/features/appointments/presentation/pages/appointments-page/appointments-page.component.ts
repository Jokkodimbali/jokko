import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, forkJoin } from 'rxjs';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import {
  isNegotiationInProgressStatus,
  negotiationStatusLabel as sharedNegotiationStatusLabel,
  reservationStatusLabel,
  reservationStatusTone,
} from '../../../../../shared/utils/jokko-status-labels';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentStatus, AppointmentView } from '../../../domain/appointments.models';
import {
  NegotiationScope,
  NegotiationView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';
import { NegotiationsRealtimeService } from '../../../../services/data-access/negotiations-realtime.service';

type AppointmentTab = 'active' | 'done';
type AppointmentTone = 'blue' | 'green' | 'red' | 'neutral';
type AppointmentPeriodFilter = 'ALL' | 'FUTURE' | 'PAST' | 'WEEK' | 'MONTH';

type ScheduleItem =
  | {
      id: string;
      kind: 'appointment';
      date: Date;
      route: string[];
      queryParams: Record<string, string>;
      messageRoute: string[];
      messageQueryParams: Record<string, string>;
      appointment: AppointmentView;
    }
  | {
      id: string;
      kind: 'negotiation';
      date: Date;
      route: string[];
      queryParams: Record<string, string>;
      messageRoute: string[];
      messageQueryParams: Record<string, string>;
      negotiation: NegotiationView;
    };

interface ScheduleGroup {
  key: string;
  label: string;
  count: number;
  items: ScheduleItem[];
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
  private readonly appointmentRefreshMs = 5000;
  private negotiationRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private appointmentRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private negotiationRealtimeSubscription?: Subscription;
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly serviceProposalService = inject(ServiceProposalService);
  private readonly negotiationsRealtime = inject(NegotiationsRealtimeService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointments = signal<AppointmentView[]>([]);
  protected readonly negotiations = signal<NegotiationView[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadErrorMessage = signal<string | null>(null);
  protected readonly activeTab = signal<AppointmentTab>('active');
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

  protected readonly totalItems = computed(() => this.scheduleItems().length);

  protected readonly monthLabel = computed(() => {
    const reference = this.referenceDate();
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(reference);
  });

  protected readonly stats = computed(() => ({
    upcoming: this.scheduleItems().filter((item) => this.isFutureDate(item.date) && !this.isFinishedItem(item)).length,
    week: this.scheduleItems().filter((item) => this.isThisWeekDate(item.date) && !this.isFinishedItem(item)).length,
    negotiating: this.scheduleItems().filter((item) => item.kind === 'negotiation' && !this.isFinishedItem(item)).length,
  }));

  protected readonly activeItemsCount = computed(() =>
    this.scheduleItems().filter((item) => !this.isFinishedItem(item)).length,
  );

  protected readonly doneItemsCount = computed(() =>
    this.scheduleItems().filter((item) => this.isFinishedItem(item)).length,
  );

  protected readonly scheduleItems = computed<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = this.sortedAppointmentList().map((appointment) => ({
      id: `appointment-${appointment.id}`,
      kind: 'appointment',
      date: this.safeDate(appointment.scheduledAt),
      route: this.primaryActionRoute(appointment),
      queryParams: this.primaryActionQueryParams(),
      messageRoute: ['/messages'],
      messageQueryParams: this.appointmentMessageQueryParams(appointment),
      appointment,
    }));
    const reservationIds = new Set(this.appointments().map((appointment) => appointment.id));

    for (const negotiation of this.sortedNegotiationList()) {
      if (negotiation.reservationId && reservationIds.has(negotiation.reservationId)) continue;
      items.push({
        id: `negotiation-${negotiation.id}`,
        kind: 'negotiation',
        date: this.negotiationDate(negotiation),
        route: this.negotiationRoute(negotiation),
        queryParams: this.negotiationQueryParams(negotiation),
        messageRoute: ['/messages'],
        messageQueryParams: this.negotiationMessageQueryParams(negotiation),
        negotiation,
      });
    }

    return items.sort((left, right) => this.compareScheduleDates(left.date, right.date));
  });

  protected readonly visibleScheduleItems = computed(() => {
    const period = this.activePeriod();
    const selectedDate = this.selectedCalendarDate();
    const term = this.search().trim().toLowerCase();

    return this.scheduleItems().filter((item) => {
      const matchesTab = this.matchesActiveTab(item);
      const matchesPeriod = this.matchesDatePeriod(item.date, period);
      const matchesCalendarDate = !selectedDate || this.dateKey(item.date) === selectedDate;
      const matchesSearch =
        term.length === 0 ||
        [
          this.scheduleItemContactName(item),
          this.scheduleItemCategory(item),
          this.scheduleItemTitle(item),
          this.scheduleItemAddress(item),
          this.scheduleItemStatusLabel(item),
        ].some((value) => value.toLowerCase().includes(term));

      return matchesTab && matchesPeriod && matchesCalendarDate && matchesSearch;
    });
  });

  protected readonly groupedScheduleItems = computed<ScheduleGroup[]>(() => {
    const groups = new Map<string, ScheduleItem[]>();

    for (const item of this.visibleScheduleItems()) {
      const key = Number.isNaN(item.date.getTime()) ? 'unknown' : this.dateKey(item.date);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: key === 'unknown' ? 'Date a confirmer' : this.formatGroupDate(items[0].date),
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
    const activeDates = this.scheduleItems()
      .filter((item) => this.matchesActiveTab(item))
      .map((item) => item.date);
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
    return this.visibleScheduleItems().filter((item) => this.dateKey(item.date) === selectedDate).length;
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
    this.scheduleItems()
      .filter((item) => this.isFutureDate(item.date) && !this.isFinishedItem(item))
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .reduce<{ key: string; label: string; count: number }[]>((dates, item) => {
        const date = item.date;
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
    this.restoreTabFromUrl();
    this.loadAppointments();
  }

  ngOnDestroy(): void {
    if (this.negotiationRefreshIntervalId) {
      clearInterval(this.negotiationRefreshIntervalId);
    }
    if (this.appointmentRefreshIntervalId) {
      clearInterval(this.appointmentRefreshIntervalId);
    }
    this.negotiationRealtimeSubscription?.unsubscribe();
  }

  protected setTab(tab: AppointmentTab): void {
    this.activeTab.set(tab);
    this.selectedCalendarDate.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'done' ? { tab } : { tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.refreshAppointments();
    this.refreshNegotiations();
  }

  protected setSearch(value: string): void {
    this.search.set(value);
  }

  protected setSearchFromEvent(event: Event): void {
    this.setSearch((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected setPeriodFilter(value: string): void {
    if (value === 'ALL' || value === 'FUTURE' || value === 'PAST' || value === 'WEEK' || value === 'MONTH') {
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
    if (appointment.status === 'LITIGE' || appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'red';
    return reservationStatusTone(appointment.status);
  }

  protected statusLabel(appointment: AppointmentView): string {
    if (appointment.status === 'LITIGE') return 'Litige';
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'Urgent';

    return reservationStatusLabel(appointment.status);
  }

  protected statusPanelTitle(appointment: AppointmentView): string {
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
    return 0;
  }

  protected canCancel(appointment: AppointmentView): boolean {
    return this.hasCancellableStatus(appointment.status) && this.isMoreThanHoursBefore(appointment.scheduledAt, 24);
  }

  protected primaryActionLabel(appointment: AppointmentView): string {
    if (this.canProviderCloseAppointment(appointment)) return 'Cloturer';
    if (this.shouldPayAppointment(appointment)) return 'Payer';
    if (appointment.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT') return 'Repondre';
    return 'Resume';
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
    return { returnUrl: this.currentAppointmentsReturnUrl() };
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
    return this.initialsFromName(appointment.doctorName, 'JD');
  }

  protected scheduleItemContactName(item: ScheduleItem): string {
    if (item.kind === 'negotiation') return this.negotiationContactName(item.negotiation);
    return item.appointment.doctorName;
  }

  protected scheduleItemCategory(item: ScheduleItem): string {
    return item.kind === 'appointment'
      ? item.appointment.specialty
      : item.negotiation.service?.nom || 'Negociation du prix';
  }

  protected scheduleItemTitle(item: ScheduleItem): string {
    if (item.kind === 'appointment') {
      if (item.appointment.status === 'ANNULEE') {
        return 'Prix propose';
      }
      return item.appointment.serviceName;
    }
    if (item.negotiation.statut === 'REFUSEE' || item.negotiation.statut === 'ANNULEE') {
      return 'Prix propose';
    }
    return item.negotiation.service?.nom || 'Proposition de prix';
  }

  protected scheduleItemAddress(item: ScheduleItem): string {
    return item.kind === 'appointment'
      ? item.appointment.locationLabel
      : item.negotiation.adresseClientProposee || 'Adresse a confirmer';
  }

  protected scheduleItemTimeLabel(item: ScheduleItem): string {
    const start = item.date;
    if (Number.isNaN(start.getTime())) return 'Horaire a confirmer';
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(start);
  }

  protected scheduleItemDateLabel(item: ScheduleItem): string {
    if (Number.isNaN(item.date.getTime())) return 'Date a confirmer';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(item.date);
  }

  protected scheduleItemAmountLabel(item: ScheduleItem): string {
    const amount = item.kind === 'appointment'
      ? item.appointment.agreedPrice ?? item.appointment.servicePrice
      : this.negotiationFinalPrice(item.negotiation) ?? Number(item.negotiation.montantCourant || item.negotiation.montantInitial);
    return amount ? `${this.formatAmount(amount)} FCFA` : 'Montant a confirmer';
  }

  protected scheduleItemAvatarUrl(item: ScheduleItem): string | null {
    if (item.kind === 'negotiation') return this.negotiationAvatarUrl(item.negotiation);
    return item.appointment.avatarUrl || null;
  }

  protected scheduleItemPhoneHref(item: ScheduleItem): string | null {
    const phone = item.kind === 'appointment'
      ? item.appointment.professionalPhone
      : this.negotiationPhoneNumber(item.negotiation);
    return phone ? `tel:${phone.replace(/\s/g, '')}` : null;
  }

  protected scheduleItemInitials(item: ScheduleItem): string {
    return this.initialsFromName(this.scheduleItemContactName(item), item.kind === 'appointment' ? 'JD' : 'JK');
  }

  protected scheduleItemTone(item: ScheduleItem): AppointmentTone {
    return item.kind === 'appointment' ? this.rowTone(item.appointment) : this.negotiationTone(item.negotiation);
  }

  protected scheduleItemStatusLabel(item: ScheduleItem): string {
    return item.kind === 'appointment' ? this.statusLabel(item.appointment) : this.negotiationStatusLabel(item.negotiation);
  }

  protected scheduleItemRoute(item: ScheduleItem): string[] {
    return item.kind === 'appointment' ? this.primaryActionRoute(item.appointment) : this.negotiationRoute(item.negotiation);
  }

  protected scheduleItemQueryParams(item: ScheduleItem): Record<string, string> {
    return item.kind === 'appointment' ? this.primaryActionQueryParams() : this.negotiationQueryParams(item.negotiation);
  }

  protected scheduleItemCanCancel(item: ScheduleItem): boolean {
    return item.kind === 'appointment' && this.canCancel(item.appointment);
  }

  protected scheduleItemCancelLabel(item: ScheduleItem): string {
    return item.kind === 'appointment' && this.cancellingAppointmentId() === item.appointment.id ? 'Annulation...' : 'Annuler';
  }

  protected scheduleItemCancelTitle(item: ScheduleItem): string {
    return item.kind === 'appointment' ? this.cancellationDisabledReason(item.appointment) : 'Annulation indisponible pour cette negociation.';
  }

  protected scheduleItemActionLabel(item: ScheduleItem): string {
    return item.kind === 'appointment'
      ? this.primaryActionLabel(item.appointment)
      : this.negotiationActionLabel(item.negotiation);
  }

  protected scheduleItemActionIcon(item: ScheduleItem): string {
    return item.kind === 'appointment'
      ? this.primaryActionIcon(item.appointment)
      : this.negotiationActionIcon(item.negotiation);
  }

  protected cancelScheduleItem(item: ScheduleItem, event: Event): void {
    if (item.kind !== 'appointment') return;
    this.cancelAppointment(item.appointment, event);
  }

  protected negotiationActionLabel(negotiation: NegotiationView): string {
    return this.isNegotiationAwaitingCurrentUser(negotiation) ? 'Negocier' : 'Voir le detail';
  }

  protected negotiationActionIcon(negotiation: NegotiationView): string {
    return this.isNegotiationAwaitingCurrentUser(negotiation) ? 'send' : 'arrow-right';
  }

  private initialsFromName(name: string, fallback: string): string {
    return userInitials(name, fallback);
  }

  protected negotiationContactName(negotiation: NegotiationView): string {
    return negotiation.professionnel?.nomEntreprise
      || negotiation.professionnel?.utilisateur.nom
      || 'Prestataire';
  }

  protected negotiationInitials(negotiation: NegotiationView): string {
    return this.initialsFromName(this.negotiationContactName(negotiation), 'CL');
  }

  protected negotiationAvatarUrl(negotiation: NegotiationView): string | null {
    return negotiation.professionnel?.utilisateur.urlAvatar || null;
  }

  protected negotiationPhoneNumber(negotiation: NegotiationView): string | null {
    void negotiation;
    return null;
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

  protected negotiationProviderOffer(negotiation: NegotiationView): number {
    const providerOffer = this.latestNegotiationOffer(negotiation, 'PRESTATAIRE');
    return providerOffer ?? Number(negotiation.service?.prix || negotiation.montantInitial);
  }

  protected negotiationClientOffer(negotiation: NegotiationView): number {
    const clientOffer = this.latestNegotiationOffer(negotiation, 'CLIENT');
    return clientOffer ?? Number(negotiation.montantInitial);
  }

  protected negotiationPriceDifference(negotiation: NegotiationView): number {
    return this.negotiationClientOffer(negotiation) - this.negotiationProviderOffer(negotiation);
  }

  protected negotiationDifferenceLabel(negotiation: NegotiationView): string {
    const difference = this.negotiationPriceDifference(negotiation);
    const amount = this.formatAmount(Math.abs(difference));
    if (difference === 0) return 'Les deux offres sont identiques';
    return `L'offre client est de ${amount} FCFA ${difference > 0 ? 'au-dessus' : 'en dessous'} de l'offre prestataire`;
  }

  protected negotiationFinalPrice(negotiation: NegotiationView): number | null {
    if (
      negotiation.statut !== 'ACCEPTEE' &&
      negotiation.statut !== 'CONVERTIE_EN_RESERVATION'
    ) {
      return null;
    }

    return Number(negotiation.montantAccepte ?? negotiation.montantCourant);
  }

  protected negotiationOfferStateLabel(
    negotiation: NegotiationView,
    actor: 'CLIENT' | 'PRESTATAIRE',
  ): string {
    if (negotiation.dernierProposePar !== actor) return '';
    if (negotiation.statut === 'EN_ATTENTE_CLIENT' || negotiation.statut === 'EN_ATTENTE_PRESTATAIRE') {
      return 'Derniere offre';
    }
    return 'Derniere proposition';
  }

  protected negotiationStatusLabel(negotiation: NegotiationView): string {
    return sharedNegotiationStatusLabel(negotiation.statut);
  }

  protected negotiationTone(negotiation: NegotiationView): AppointmentTone {
    if (negotiation.statut === 'ACCEPTEE' || negotiation.statut === 'CONVERTIE_EN_RESERVATION') return 'green';
    if (negotiation.statut === 'REFUSEE') return 'red';
    if (negotiation.statut === 'ANNULEE') return 'red';
    if (isNegotiationInProgressStatus(negotiation.statut)) return 'red';
    return 'red';
  }

  protected negotiationRoute(negotiation: NegotiationView): string[] {
    if (negotiation.reservationId) {
      return ['/appointments', negotiation.reservationId];
    }
    return ['/services', negotiation.professionnelId, 'proposition'];
  }

  protected negotiationQueryParams(negotiation: NegotiationView): Record<string, string> {
    if (negotiation.reservationId) {
      return { returnUrl: this.currentAppointmentsReturnUrl() };
    }
    return {
      serviceId: negotiation.serviceId,
      negotiationId: negotiation.id,
      returnUrl: this.currentAppointmentsReturnUrl(),
    };
  }

  private restoreTabFromUrl(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'done') {
      this.activeTab.set('done');
    }
  }

  private appointmentMessageQueryParams(appointment: AppointmentView): Record<string, string> {
    return {
      reservationId: appointment.id,
      returnUrl: this.currentAppointmentsReturnUrl(),
    };
  }

  private negotiationMessageQueryParams(negotiation: NegotiationView): Record<string, string> {
    return {
      negotiationId: negotiation.id,
      ...(negotiation.reservationId ? { reservationId: negotiation.reservationId } : {}),
      returnUrl: this.currentAppointmentsReturnUrl(),
    };
  }

  private currentAppointmentsReturnUrl(): string {
    return this.activeTab() === 'done' ? '/appointments?tab=done' : '/appointments';
  }

  private isNegotiationAwaitingCurrentUser(negotiation: NegotiationView): boolean {
    return negotiation.statut === 'EN_ATTENTE_CLIENT';
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
        this.startAppointmentRefresh(scope);
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
    if (role === 'CLIENT' || role === 'PRESTATAIRE' || role === 'MEDECIN') return 'CLIENT';
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
    this.startNegotiationRealtime(scope);

    this.negotiationRefreshIntervalId = setInterval(() => {
      if (document.hidden) return;
      this.refreshNegotiations(scope);
    }, this.negotiationRefreshMs);
  }

  private startNegotiationRealtime(scope: NegotiationScope): void {
    this.negotiationRealtimeSubscription?.unsubscribe();
    this.negotiationRealtimeSubscription = this.negotiationsRealtime
      .watchMyNegotiations(scope)
      .subscribe((event) => {
        if (event.negotiation) {
          this.upsertNegotiation(event.negotiation);
        }
        this.refreshNegotiations(scope);
      });
  }

  private startAppointmentRefresh(scope: 'CLIENT' | 'PRESTATAIRE'): void {
    if (this.appointmentRefreshIntervalId) {
      clearInterval(this.appointmentRefreshIntervalId);
    }

    this.appointmentRefreshIntervalId = setInterval(() => {
      if (document.hidden) return;
      this.refreshAppointments(scope);
    }, this.appointmentRefreshMs);
  }

  private refreshAppointments(scope = this.resolveReservationScope()): void {
    if (!scope) return;
    this.appointmentsService.listMyAppointments(scope).subscribe({
      next: (appointments) => this.appointments.set(appointments),
    });
  }

  private refreshNegotiations(scope = this.resolveReservationScope()): void {
    if (!scope) return;
    this.serviceProposalService.listMyPriceProposals(scope, true).subscribe({
      next: (negotiations) => this.negotiations.set(negotiations),
    });
  }

  private upsertNegotiation(negotiation: NegotiationView): void {
    this.negotiations.update((items) => {
      const exists = items.some((item) => item.id === negotiation.id);
      return exists
        ? items.map((item) => (item.id === negotiation.id ? negotiation : item))
        : [negotiation, ...items];
    });
  }

  private latestNegotiationOffer(
    negotiation: NegotiationView,
    actor: 'CLIENT' | 'PRESTATAIRE',
  ): number | null {
    const offer = [...(negotiation.propositions ?? [])]
      .reverse()
      .find((item) => item.proposePar === actor);
    const amount = Number(offer?.montant);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  private matchesDatePeriod(date: Date, filter: AppointmentPeriodFilter): boolean {
    if (filter === 'ALL') return true;
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'FUTURE') return date >= start;
    if (filter === 'PAST') return date < start;

    if (filter === 'WEEK') {
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return date >= start && date < end;
    }

    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  private isDone(status: AppointmentStatus): boolean {
    return status === 'TERMINEE' || status === 'ANNULEE' || status === 'NO_SHOW' || status === 'LITIGE';
  }

  private isFutureAppointment(appointment: AppointmentView): boolean {
    if (this.isDone(appointment.status) || appointment.status === 'LITIGE') return false;
    return !this.isPastAppointment(appointment);
  }

  private isPastAppointment(appointment: AppointmentView): boolean {
    const date = this.safeDate(appointment.scheduledAt);
    return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
  }

  private hasCancellableStatus(status: AppointmentStatus): boolean {
    return (
      status === 'CONFIRMEE' ||
      status === 'PAYEE_SEQUESTRE' ||
      status === 'EN_COURS'
    );
  }

  private shouldPayAppointment(appointment: AppointmentView): boolean {
    return (
      !!appointment.agreedPrice &&
      appointment.agreedPrice > 0 &&
      appointment.status === 'CONFIRMEE'
    );
  }

  private canProviderCloseAppointment(appointment: AppointmentView): boolean {
    void appointment;
    return false;
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

  private isFutureDate(date: Date): boolean {
    return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now();
  }

  private isThisWeekDate(date: Date): boolean {
    if (Number.isNaN(date.getTime())) return false;
    const diffMs = date.getTime() - Date.now();
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  protected isFinishedItem(item: ScheduleItem): boolean {
    if (item.kind === 'appointment') return this.isDone(item.appointment.status);
    return item.negotiation.statut === 'REFUSEE' || item.negotiation.statut === 'ANNULEE';
  }

  private matchesActiveTab(item: ScheduleItem): boolean {
    return this.activeTab() === 'done'
      ? this.isFinishedItem(item)
      : !this.isFinishedItem(item);
  }

  private sortedAppointments(appointments: AppointmentView[]): AppointmentView[] {
    return [...appointments].sort(
      (a, b) => this.compareScheduleDates(this.safeDate(a.scheduledAt), this.safeDate(b.scheduledAt)),
    );
  }

  private compareScheduleDates(left: Date, right: Date): number {
    const leftTime = left.getTime();
    const rightTime = right.getTime();
    const leftInvalid = Number.isNaN(leftTime);
    const rightInvalid = Number.isNaN(rightTime);

    if (leftInvalid && rightInvalid) return 0;
    if (leftInvalid) return 1;
    if (rightInvalid) return -1;

    return rightTime - leftTime;
  }

  private referenceDate(): Date {
    const date = this.scheduleItems()[0]?.date ?? new Date(Number.NaN);
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

