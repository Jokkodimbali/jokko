import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AuthService } from '../../../../auth/data-access/auth.service';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import {
  NegotiationView,
  ReservationAvailabilitySlotView,
  ReservationAvailabilityView,
  ServiceProposalService,
} from '../../../data-access/service-proposal.service';
import { ServicesService } from '../../../data-access/services.service';
import {
  BackendProfessionalDetailService,
  ProviderProfileDetail,
} from '../../../domain/models/services.models';

type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'VISA';

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  mark: string;
  logoUrl: string;
}

interface ReservationDraft {
  service: BackendProfessionalDetailService;
  amount: number;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  paymentMethod: PaymentMethod;
}

@Component({
  selector: 'app-service-proposal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppFooterComponent,
    AppNavbarComponent,
    LucideAngularModule,
  ],
  templateUrl: './service-proposal.component.html',
  styleUrl: './service-proposal.component.scss',
})
export class ServiceProposalComponent implements OnDestroy, OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly servicesService = inject(ServicesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly messagesService = inject(MessagesService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly authSession = inject(AuthSessionService);

  protected readonly detail = signal<ProviderProfileDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly isCheckingAvailability = signal(false);
  protected readonly isLoadingAvailabilitySlots = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly availabilityStatus = signal<ReservationAvailabilityView | null>(null);
  protected readonly availabilitySlots = signal<ReservationAvailabilitySlotView[]>([]);

  protected readonly profileId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly selectedServiceId = signal(
    this.route.snapshot.queryParamMap.get('serviceId') || '',
  );
  protected readonly selectedPayment = signal<PaymentMethod>('WAVE');

  protected readonly appointmentDate = signal(this.toDateInputValue(this.getDefaultAppointmentDate()));
  protected readonly address = signal('');
  protected readonly offerAmount = signal(0);
  protected readonly durationMinutes = 60;

  protected readonly paymentOptions: PaymentOption[] = [
    { id: 'WAVE', label: 'WAVE', mark: 'W', logoUrl: '/wave.png' },
    {
      id: 'ORANGE_MONEY',
      label: 'Orange Money',
      mark: 'OM',
      logoUrl: '/Orange-Money-logo.png',
    },
    { id: 'VISA', label: 'VISA', mark: 'VISA', logoUrl: '/logo vissa.avif' },
  ];

  protected readonly currentService = computed<BackendProfessionalDetailService | null>(() => {
    const services = this.detail()?.services ?? [];
    const selectedId = this.selectedServiceId();
    return services.find((service) => service.id === selectedId) ?? services[0] ?? null;
  });

  protected readonly displayName = computed(() => {
    const profile = this.detail()?.profile;
    return profile?.nomEntreprise || profile?.utilisateur.nom || 'Prestataire';
  });

  protected readonly avatarUrl = computed(
    () => this.detail()?.profile.utilisateur.urlAvatar || '/medicine-doctor-charle-diouf.png',
  );

  protected readonly categoryLabel = computed(() => this.currentService()?.nom || 'Service Jokko');

  protected readonly ratingLabel = computed(() => {
    const profile = this.detail()?.profile;
    if (!profile) return 'Nouveau';
    const rating = Number(profile.noteGlobale || 0).toFixed(1);
    return `${rating}  ${profile.nombreAvis || 0} mission`;
  });

  protected readonly formattedDate = computed(() => {
    const date = new Date(this.appointmentDate());
    if (Number.isNaN(date.getTime())) return 'Date a choisir';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date).toUpperCase().replace('.', '');
  });

  protected readonly shortAddress = computed(() => this.truncate(this.address(), 28));
  protected readonly formattedOffer = computed(() => this.formatAmount(this.offerAmount()));
  protected readonly minAppointmentDate = computed(() =>
    this.toDateInputValue(new Date(Date.now() + 5 * 60 * 1000)),
  );
  protected readonly appointmentDay = computed(() => this.appointmentDate().slice(0, 10));
  protected readonly minAppointmentDay = computed(() => this.minAppointmentDate().slice(0, 10));
  protected readonly selectedSlotLabel = computed(() => {
    const selectedIso = this.toIsoDateTime(this.appointmentDate());
    const slot = this.availabilitySlots().find((item) => item.dateHeure === selectedIso);
    return slot?.label || 'Heure a choisir';
  });
  protected readonly availabilityLabel = computed(() => {
    if (this.isLoadingAvailabilitySlots()) {
      return 'Chargement des heures du prestataire...';
    }

    if (this.isCheckingAvailability()) {
      return 'Verification du creneau selectionne...';
    }

    if (this.availabilitySlots().length === 0) {
      return 'Aucun creneau disponible pour cette date.';
    }

    const status = this.availabilityStatus();
    if (!status) {
      return 'Selectionnez une heure disponible.';
    }

    return status.available ? 'Creneau disponible pour ce prestataire.' : status.reason;
  });
  protected readonly isAvailabilityValid = computed(
    () => this.availabilityStatus()?.available === true && !this.isCheckingAvailability(),
  );
  private availabilityCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadDetail();
  }

  ngOnDestroy(): void {
    if (this.availabilityCheckTimeoutId) {
      clearTimeout(this.availabilityCheckTimeoutId);
    }
  }

  protected goBack(): void {
    this.location.back();
  }

  protected selectPayment(method: PaymentMethod): void {
    this.selectedPayment.set(method);
  }

  protected updateOfferAmount(value: number | string): void {
    const amount = Number(value);
    this.offerAmount.set(Number.isFinite(amount) ? amount : 0);
  }

  protected updateAppointmentDate(value: string): void {
    this.appointmentDate.set(value);
    this.scheduleAvailabilityCheck();
  }

  protected updateAppointmentDay(value: string): void {
    if (!value) {
      return;
    }

    this.appointmentDate.set(`${value}T10:00`);
    this.scheduleAvailabilityCheck();
  }

  protected selectAvailabilitySlot(slot: ReservationAvailabilitySlotView): void {
    if (!slot.available) {
      this.feedback.success(slot.reason || 'Ce creneau nest pas disponible.');
      return;
    }

    this.appointmentDate.set(this.toDateInputValue(new Date(slot.dateHeure)));
    const service = this.currentService();
    this.availabilityStatus.set({
      available: true,
      reason: slot.reason || 'Disponible',
      professionalId: service?.profilProfessionnelId || '',
      dateHeure: slot.dateHeure,
      dureeMinutes: this.durationMinutes,
      withinAvailability: true,
      hasConflict: false,
    });
  }

  protected isSlotSelected(slot: ReservationAvailabilitySlotView): boolean {
    return slot.dateHeure === this.toIsoDateTime(this.appointmentDate());
  }

  protected submitProposal(): void {
    const service = this.currentService();

    if (!this.authSession.getAccessToken()) {
      this.feedback.success('Connectez-vous pour proposer un prix.');
      this.router.navigate(['/auth/login']);
      return;
    }

    const draft = this.validateReservationDraft(service);
    if (!draft) {
      return;
    }

    if (draft.service.typePrix !== 'NEGOCIABLE') {
      this.createDirectReservation(draft);
      return;
    }

    this.isSubmitting.set(true);
    this.proposalService.findActiveProposalForService(draft.service.id).subscribe({
      next: (activeProposal) => {
        if (activeProposal) {
          this.updateActiveProposalThenOpenDiscussion(activeProposal, draft);
          return;
        }

        this.createProposal(draft);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.handleProposalError(error);
      },
    });
  }

  private createProposal(draft: ReservationDraft): void {
    this.proposalService
      .createPriceProposal({
        serviceId: draft.service.id,
        proposedAmount: draft.amount,
        message: this.buildProposalMessage(draft),
        dateHeure: draft.dateHeure,
        adresseClient: draft.adresseClient,
        dureeMinutes: draft.dureeMinutes,
      })
      .subscribe({
        next: (proposal) => {
          const hasExistingHistory = (proposal.propositions?.length ?? 0) > 1;
          this.feedback.success(
            hasExistingHistory
              ? 'Une discussion est deja ouverte pour ce service.'
              : 'Votre proposition a ete envoyee au prestataire.',
          );
          this.openConversationThenGoToDiscussion(proposal, draft);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private updateActiveProposalThenOpenDiscussion(
    activeProposal: NegotiationView,
    draft: ReservationDraft,
  ): void {
    this.proposalService
      .counterPriceProposal(activeProposal.id, {
        serviceId: draft.service.id,
        proposedAmount: draft.amount,
        message: this.buildProposalMessage(draft),
        dateHeure: draft.dateHeure,
        adresseClient: draft.adresseClient,
        dureeMinutes: draft.dureeMinutes,
      })
      .subscribe({
        next: (proposal) => {
          this.feedback.success('Votre nouvelle proposition a ete envoyee.');
          this.openConversationThenGoToDiscussion(proposal, draft);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private createDirectReservation(draft: ReservationDraft): void {
    this.isSubmitting.set(true);
    this.proposalService
      .createDirectReservation({
        professionnelId: draft.service.profilProfessionnelId,
        serviceId: draft.service.id,
        dateHeure: draft.dateHeure,
        adresseClient: draft.adresseClient,
        dureeMinutes: draft.dureeMinutes,
        notes: [
          `Montant affiche: ${this.formatAmount(draft.amount)} FCFA.`,
          `Paiement choisi: ${draft.paymentMethod}.`,
        ].join(' '),
      })
      .subscribe({
        next: () => {
          this.feedback.success('Votre reservation a ete envoyee au prestataire.');
          this.router.navigate(['/appointments']);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private handleProposalError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const errorCode = (error.error as { errorCode?: string } | undefined)?.errorCode;

      if (error.status === 401) {
        this.feedback.success('Votre session a expire. Connectez-vous pour continuer.');
        this.router.navigate(['/auth/login']);
        return;
      }

      if (errorCode === 'NEGOTIATIONS_ALREADY_ACTIVE') {
        this.feedback.success('Une discussion est deja ouverte pour ce service.');
        const service = this.currentService();
        if (service) {
          this.openDirectConversationThenGoToDiscussion(service, this.offerAmount());
        } else {
          this.router.navigate(['/messages']);
        }
        return;
      }
    }

    this.feedback.success(
      getHttpErrorMessage(error, "Impossible d'envoyer cette proposition pour le moment."),
    );
  }

  private loadDetail(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      detail: this.servicesService.getProviderProfileDetail(this.profileId),
      user: this.authSession.hasAuthenticatedSession()
        ? this.authService.myUserProfile().pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ detail, user }) => {
        this.detail.set(detail);
        const service = this.currentService();
        this.selectedServiceId.set(service?.id || '');
        this.offerAmount.set(service?.prix ?? 0);
        this.address.set(user?.adresse?.trim() || this.resolveInitialAddress(detail));
        this.isLoading.set(false);
        this.scheduleAvailabilityCheck();
      },
      error: () => {
        this.errorMessage.set('Impossible de charger les informations du rendez-vous.');
        this.isLoading.set(false);
      },
    });
  }

  private resolveInitialAddress(detail: ProviderProfileDetail): string {
    void detail;
    return '';
  }

  private buildProposalMessage(draft: ReservationDraft): string {
    return [
      `Service: ${draft.service.nom || this.categoryLabel()}.`,
      `Proposition de prix: ${this.formatAmount(draft.amount)} FCFA.`,
      `Date souhaitee: ${this.formatProposalDate(draft.dateHeure)}.`,
      `Adresse: ${draft.adresseClient}.`,
      `Duree: ${draft.dureeMinutes} minutes.`,
      `Paiement choisi: ${draft.paymentMethod}.`,
    ].join(' ');
  }

  private openConversationThenGoToDiscussion(
    proposal: NegotiationView,
    draft: ReservationDraft,
  ): void {
    const professionalProfileId = proposal.professionnelId || draft.service.profilProfessionnelId;

    if (!professionalProfileId) {
      this.isSubmitting.set(false);
      this.feedback.success('Impossible d ouvrir la discussion avec ce prestataire.');
      return;
    }

    this.messagesService.createConversation({ professionalProfileId }).subscribe({
      next: (conversation) => {
        const queryParams = this.buildDiscussionQueryParams(
          proposal,
          draft,
          conversation.id,
        );

        this.messagesService.sendMessage(conversation.id, this.buildProposalMessage(draft)).subscribe({
          next: () => this.navigateToDiscussion(queryParams),
          error: () => this.navigateToDiscussion(queryParams),
        });
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.handleProposalError(error);
      },
    });
  }

  private openDirectConversationThenGoToDiscussion(
    service: BackendProfessionalDetailService,
    fallbackAmount: number,
  ): void {
    this.messagesService
      .createConversation({ professionalProfileId: service.profilProfessionnelId })
      .subscribe({
        next: (conversation) => {
          this.isSubmitting.set(false);
          this.router.navigate(['/messages'], {
            queryParams: this.buildDiscussionQueryParams(
              null,
              this.buildFallbackReservationDraft(service, fallbackAmount),
              conversation.id,
            ),
          });
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private buildDiscussionQueryParams(
    proposal: NegotiationView | null,
    draft: ReservationDraft,
    conversationId?: string,
  ) {
    return {
      conversationId,
      negotiationId: proposal?.id,
      professionalId: proposal?.professionnelId || draft.service.profilProfessionnelId,
      appointmentDate: draft.dateHeure,
      address: draft.adresseClient,
      durationMinutes: draft.dureeMinutes,
      amount:
        Number.isFinite(draft.amount) && draft.amount > 0
          ? draft.amount
          : proposal?.montantCourant || 0,
      providerName: this.displayName(),
      serviceName: draft.service.nom || this.categoryLabel(),
      status: proposal?.statut || 'EN_ATTENTE_PRESTATAIRE',
    };
  }

  private navigateToDiscussion(queryParams: Record<string, unknown>): void {
    this.isSubmitting.set(false);
    this.router.navigate(['/messages'], { queryParams });
  }

  private isValidAppointmentDate(): boolean {
    const selectedDate = new Date(this.appointmentDate());
    if (Number.isNaN(selectedDate.getTime())) {
      return false;
    }

    return selectedDate.getTime() > Date.now();
  }

  private validateReservationDraft(
    service: BackendProfessionalDetailService | null,
  ): ReservationDraft | null {
    if (!service) {
      this.feedback.success('Selectionnez un service valide avant de confirmer.');
      return null;
    }

    const amount = Math.trunc(Number(this.offerAmount()));
    if (!Number.isFinite(amount) || amount < 500 || amount > 10_000_000) {
      this.feedback.success('Renseignez un montant entre 500 et 10 000 000 FCFA.');
      return null;
    }

    const dateHeure = this.toIsoDateTime(this.appointmentDate());
    if (!dateHeure || !this.isValidAppointmentDate()) {
      this.feedback.success('Choisissez une date et une heure future pour le rendez-vous.');
      return null;
    }

    if (this.isCheckingAvailability() || this.isLoadingAvailabilitySlots()) {
      this.feedback.success('Patientez pendant la verification des creneaux.');
      return null;
    }

    const availabilityStatus = this.availabilityStatus();
    if (!availabilityStatus || availabilityStatus.dateHeure !== dateHeure) {
      this.feedback.success('Verifiez la disponibilite du creneau avant de confirmer.');
      this.checkAvailabilityNow(service, dateHeure);
      return null;
    }

    if (!availabilityStatus.available) {
      this.feedback.success(availabilityStatus.reason || 'Ce creneau nest pas disponible.');
      return null;
    }

    const adresseClient = this.address().trim().replace(/\s+/g, ' ');
    if (adresseClient.length < 5 || adresseClient.length > 180) {
      this.feedback.success('Renseignez une adresse precise entre 5 et 180 caracteres.');
      return null;
    }

    if (!Number.isInteger(this.durationMinutes) || this.durationMinutes < 15 || this.durationMinutes > 1440) {
      this.feedback.success('La duree du rendez-vous est invalide.');
      return null;
    }

    const paymentMethod = this.selectedPayment();
    if (!this.paymentOptions.some((payment) => payment.id === paymentMethod)) {
      this.feedback.success('Selectionnez un moyen de paiement valide.');
      return null;
    }

    return {
      service,
      amount,
      dateHeure,
      adresseClient,
      dureeMinutes: this.durationMinutes,
      paymentMethod,
    };
  }

  private scheduleAvailabilityCheck(): void {
    if (this.availabilityCheckTimeoutId) {
      clearTimeout(this.availabilityCheckTimeoutId);
    }

    this.availabilityStatus.set(null);
    this.availabilityCheckTimeoutId = setTimeout(() => {
      const service = this.currentService();
      const date = this.appointmentDay();
      if (!service || !date) {
        this.isCheckingAvailability.set(false);
        this.isLoadingAvailabilitySlots.set(false);
        return;
      }

      this.loadAvailabilitySlots(service, date);
    }, 450);
  }

  private loadAvailabilitySlots(
    service: BackendProfessionalDetailService,
    date: string,
  ): void {
    this.isLoadingAvailabilitySlots.set(true);
    this.availabilitySlots.set([]);
    this.proposalService
      .listReservationAvailabilitySlots({
        professionalId: service.profilProfessionnelId,
        date,
        dureeMinutes: this.durationMinutes,
      })
      .subscribe({
        next: (result) => {
          if (this.appointmentDay() !== result.date) {
            return;
          }

          this.availabilitySlots.set(result.slots);
          const selectedIso = this.toIsoDateTime(this.appointmentDate());
          const selectedSlot = result.slots.find((slot) => slot.dateHeure === selectedIso);

          if (selectedSlot?.available) {
            this.selectAvailabilitySlot(selectedSlot);
          } else {
            this.availabilityStatus.set(null);
          }

          this.isLoadingAvailabilitySlots.set(false);
        },
        error: () => {
          this.availabilitySlots.set([]);
          this.availabilityStatus.set(null);
          this.isLoadingAvailabilitySlots.set(false);
        },
      });
  }

  private checkAvailabilityNow(
    service: BackendProfessionalDetailService,
    dateHeure: string,
  ): void {
    this.isCheckingAvailability.set(true);
    this.proposalService
      .checkReservationAvailability({
        professionalId: service.profilProfessionnelId,
        dateHeure,
        dureeMinutes: this.durationMinutes,
      })
      .subscribe({
        next: (status) => {
          if (this.toIsoDateTime(this.appointmentDate()) === status.dateHeure) {
            this.availabilityStatus.set(status);
          }
          this.isCheckingAvailability.set(false);
        },
        error: () => {
          this.availabilityStatus.set({
            available: false,
            reason: 'Impossible de verifier ce creneau pour le moment.',
            professionalId: service.profilProfessionnelId,
            dateHeure,
            dureeMinutes: this.durationMinutes,
            withinAvailability: false,
            hasConflict: false,
          });
          this.isCheckingAvailability.set(false);
        },
      });
  }

  private buildFallbackReservationDraft(
    service: BackendProfessionalDetailService,
    fallbackAmount: number,
  ): ReservationDraft {
    const detail = this.detail();

    return {
      service,
      amount: Number.isFinite(fallbackAmount) && fallbackAmount > 0 ? Math.trunc(fallbackAmount) : service.prix || 0,
      dateHeure: this.toIsoDateTime(this.appointmentDate()) ?? this.getDefaultAppointmentDate().toISOString(),
      adresseClient: this.address().trim() || (detail ? this.resolveInitialAddress(detail) : ''),
      dureeMinutes: this.durationMinutes,
      paymentMethod: this.selectedPayment(),
    };
  }

  private getDefaultAppointmentDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return date;
  }

  private toDateInputValue(date: Date): string {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  private toIsoDateTime(value: string): string | null {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private formatProposalDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return this.formattedDate();
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .toUpperCase()
      .replace(',', '');
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0);
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 4)}....` : value;
  }
}
