import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import {
  NegotiationView,
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
export class ServiceProposalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly servicesService = inject(ServicesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly messagesService = inject(MessagesService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly authSession = inject(AuthSessionService);

  protected readonly detail = signal<ProviderProfileDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly profileId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly selectedServiceId = signal(
    this.route.snapshot.queryParamMap.get('serviceId') || '',
  );
  protected readonly selectedPayment = signal<PaymentMethod>('WAVE');

  protected readonly appointmentDate = signal(this.toDateInputValue(this.getDefaultAppointmentDate()));
  protected readonly address = signal('Dakar, Senegal');
  protected readonly offerAmount = signal(5000);
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

  ngOnInit(): void {
    this.loadDetail();
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

  protected submitProposal(): void {
    const service = this.currentService();
    const amount = Number(this.offerAmount());

    if (!this.authSession.getAccessToken()) {
      this.feedback.success('Connectez-vous pour proposer un prix.');
      this.router.navigate(['/auth/login']);
      return;
    }

    if (!this.isValidAppointmentDate()) {
      this.feedback.success('Choisissez une date et une heure future pour le rendez-vous.');
      return;
    }

    if (!this.isValidAddress()) {
      this.feedback.success('Renseignez une adresse precise pour le rendez-vous.');
      return;
    }

    if (!service || !Number.isFinite(amount) || amount < 1) {
      this.feedback.success('Renseignez un montant valide avant de confirmer.');
      return;
    }

    if (service.typePrix !== 'NEGOCIABLE') {
      this.createDirectReservation(service, amount);
      return;
    }

    this.isSubmitting.set(true);
    this.proposalService.findActiveProposalForService(service.id).subscribe({
      next: (activeProposal) => {
        if (activeProposal) {
          this.updateActiveProposalThenOpenDiscussion(activeProposal, service, amount);
          return;
        }

        this.createProposal(service.id, amount);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.handleProposalError(error);
      },
    });
  }

  private createProposal(serviceId: string, amount: number): void {
    this.proposalService
      .createPriceProposal({
        serviceId,
        proposedAmount: amount,
        message: this.buildProposalMessage(),
      })
      .subscribe({
        next: (proposal) => {
          const hasExistingHistory = (proposal.propositions?.length ?? 0) > 1;
          this.feedback.success(
            hasExistingHistory
              ? 'Une discussion est deja ouverte pour ce service.'
              : 'Votre proposition a ete envoyee au prestataire.',
          );
          this.openConversationThenGoToDiscussion(proposal, this.currentService(), amount);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private updateActiveProposalThenOpenDiscussion(
    activeProposal: NegotiationView,
    service: BackendProfessionalDetailService,
    amount: number,
  ): void {
    this.proposalService
      .counterPriceProposal(activeProposal.id, {
        serviceId: service.id,
        proposedAmount: amount,
        message: this.buildProposalMessage(),
      })
      .subscribe({
        next: (proposal) => {
          this.feedback.success('Votre nouvelle proposition a ete envoyee.');
          this.openConversationThenGoToDiscussion(proposal, service, amount);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private createDirectReservation(
    service: BackendProfessionalDetailService,
    amount: number,
  ): void {
    const dateHeure = this.toIsoDateTime(this.appointmentDate());
    if (!dateHeure) {
      this.feedback.success('Choisissez une date valide avant de confirmer.');
      return;
    }

    this.isSubmitting.set(true);
    this.proposalService
      .createDirectReservation({
        professionnelId: service.profilProfessionnelId,
        serviceId: service.id,
        dateHeure,
        adresseClient: this.address().trim() || 'Dakar, Senegal',
        dureeMinutes: this.durationMinutes,
        notes: [
          `Montant affiche: ${this.formatAmount(amount)} FCFA.`,
          `Paiement choisi: ${this.selectedPayment()}.`,
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

    this.servicesService.getProviderProfileDetail(this.profileId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        const service = this.currentService();
        this.selectedServiceId.set(service?.id || '');
        this.offerAmount.set(service?.prix || 5000);
        this.loadActiveProposalAmount(service);
        this.address.set(this.resolveInitialAddress(detail));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger les informations du rendez-vous.');
        this.isLoading.set(false);
      },
    });
  }

  private loadActiveProposalAmount(service: BackendProfessionalDetailService | null): void {
    if (!service || service.typePrix !== 'NEGOCIABLE' || !this.authSession.getAccessToken()) {
      return;
    }

    this.proposalService.findActiveProposalForService(service.id).subscribe({
      next: (proposal) => {
        const proposedAmount = proposal?.montantCourant || proposal?.montantInitial;
        if (
          typeof proposedAmount === 'number' &&
          Number.isFinite(proposedAmount) &&
          proposedAmount > 0
        ) {
          this.offerAmount.set(proposedAmount);
        }
      },
      error: () => {
        // The page remains usable with the service base price if the active proposal lookup fails.
      },
    });
  }

  private resolveInitialAddress(detail: ProviderProfileDetail): string {
    const label = detail.presence?.lastLocationLabel || detail.profile.ville;
    return label ? `${label}, Senegal` : 'Dakar, Senegal';
  }

  private buildProposalMessage(): string {
    return [
      `Proposition de prix: ${this.formatAmount(this.offerAmount())} FCFA.`,
      `Date souhaitee: ${this.formattedDate()}.`,
      `Adresse: ${this.address()}.`,
      `Paiement choisi: ${this.selectedPayment()}.`,
    ].join(' ');
  }

  private openConversationThenGoToDiscussion(
    proposal: NegotiationView,
    service: BackendProfessionalDetailService | null,
    fallbackAmount: number,
  ): void {
    const professionalProfileId = proposal.professionnelId || service?.profilProfessionnelId;

    if (!professionalProfileId) {
      this.isSubmitting.set(false);
      this.feedback.success('Impossible d ouvrir la discussion avec ce prestataire.');
      return;
    }

    this.messagesService.createConversation({ professionalProfileId }).subscribe({
      next: (conversation) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/messages'], {
          queryParams: this.buildDiscussionQueryParams(
            proposal,
            service,
            fallbackAmount,
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
              service,
              fallbackAmount,
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
    service: BackendProfessionalDetailService | null,
    fallbackAmount: number,
    conversationId?: string,
  ) {
    return {
      conversationId,
      negotiationId: proposal?.id,
      professionalId: proposal?.professionnelId || service?.profilProfessionnelId,
      amount:
        Number.isFinite(fallbackAmount) && fallbackAmount > 0
          ? fallbackAmount
          : proposal?.montantCourant || 0,
      providerName: this.displayName(),
      serviceName: service?.nom || this.categoryLabel(),
      status: proposal?.statut || 'EN_ATTENTE_PRESTATAIRE',
    };
  }

  private isValidAppointmentDate(): boolean {
    const selectedDate = new Date(this.appointmentDate());
    if (Number.isNaN(selectedDate.getTime())) {
      return false;
    }

    return selectedDate.getTime() > Date.now();
  }

  private isValidAddress(): boolean {
    const normalizedAddress = this.address().trim();
    return normalizedAddress.length >= 5;
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

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0);
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 4)}....` : value;
  }
}
