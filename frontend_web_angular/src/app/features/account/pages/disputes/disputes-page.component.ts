import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../core/navigation/back-navigation.service';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { AppointmentView } from '../../../appointments/domain/appointments.models';

type DisputeFilter = 'all' | 'upcoming' | 'completed' | 'disputed';

@Component({
  selector: 'app-disputes-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    AppFooterComponent,
  ],
  templateUrl: './disputes-page.component.html',
  styleUrl: './disputes-page.component.scss',
})
export class DisputesPageComponent implements OnInit {
  private readonly authSession = inject(AuthSessionService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointments = signal<AppointmentView[]>([]);
  protected readonly activeFilter = signal<DisputeFilter>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly scope = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'PRESTATAIRE' || role === 'MEDECIN' ? 'PRESTATAIRE' : 'CLIENT';
  });

  protected readonly disputedCount = computed(
    () => this.appointments().filter((appointment) => appointment.status === 'LITIGE').length,
  );
  protected readonly upcomingCount = computed(
    () => this.appointments().filter((appointment) => this.isUpcoming(appointment)).length,
  );
  protected readonly completedCount = computed(
    () => this.appointments().filter((appointment) => this.isCompleted(appointment)).length,
  );
  protected readonly filteredAppointments = computed(() => {
    const filter = this.activeFilter();
    const list = this.appointments();
    if (filter === 'upcoming') return list.filter((appointment) => this.isUpcoming(appointment));
    if (filter === 'completed') return list.filter((appointment) => this.isCompleted(appointment));
    if (filter === 'disputed') return list.filter((appointment) => appointment.status === 'LITIGE');
    return list;
  });

  ngOnInit(): void {
    if (!this.currentUser()) return;
    this.loadAppointments();
  }

  protected goBack(): void {
    this.backNavigation.back(null, '/services');
  }

  protected selectFilter(filter: DisputeFilter): void {
    this.activeFilter.set(filter);
  }

  protected openDisputePage(appointment: AppointmentView): void {
    if (!this.canOpenDispute(appointment) && appointment.status !== 'LITIGE') return;
    const commands = appointment.status === 'LITIGE'
      ? ['/litiges', appointment.id, 'suivi']
      : ['/litiges', appointment.id];
    this.router.navigate(commands);
  }

  protected canOpenDispute(appointment: AppointmentView): boolean {
    return appointment.status === 'TERMINEE' || appointment.status === 'NO_SHOW';
  }

  protected amountLabel(appointment: AppointmentView): string {
    return this.isPaidLike(appointment) ? 'Montant paye' : 'Montant estime';
  }

  protected formatMoney(value: number | null): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  protected statusLabel(appointment: AppointmentView): string {
    if (this.canOpenDispute(appointment)) return 'Signalez le litige';

    const labels: Record<AppointmentView['status'], string> = {
      EN_ATTENTE: 'A venir',
      CONFIRMEE: 'A venir',
      PAYEE_SEQUESTRE: 'Confirmee',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminee',
      ANNULEE: 'Annulee',
      NO_SHOW: 'Absent',
      LITIGE: 'Litige en cours',
    };
    return labels[appointment.status];
  }

  protected statusTone(appointment: AppointmentView): string {
    if (this.canOpenDispute(appointment)) return 'report';
    if (appointment.status === 'LITIGE') return 'dispute';
    if (this.isUpcoming(appointment)) return 'upcoming';
    return 'neutral';
  }

  protected actionLabel(appointment: AppointmentView): string {
    if (appointment.status === 'LITIGE') return 'Voir';
    if (this.canOpenDispute(appointment)) return 'Signaler litige';
    return 'Indisponible';
  }

  protected trackById(_index: number, appointment: AppointmentView): string {
    return appointment.id;
  }

  private loadAppointments(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .listMyAppointments(this.scope())
      .pipe(
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger vos reservations.'));
          return of([]);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((appointments) => this.appointments.set(appointments));
  }

  protected isUpcoming(appointment: AppointmentView): boolean {
    return ['EN_ATTENTE', 'CONFIRMEE', 'PAYEE_SEQUESTRE', 'EN_COURS'].includes(appointment.status);
  }

  private isCompleted(appointment: AppointmentView): boolean {
    return appointment.status === 'TERMINEE' || appointment.status === 'NO_SHOW';
  }

  private isPaidLike(appointment: AppointmentView): boolean {
    return ['PAYEE_SEQUESTRE', 'EN_COURS', 'TERMINEE', 'NO_SHOW', 'LITIGE'].includes(appointment.status);
  }
}
