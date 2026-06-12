import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
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

interface AcceptedReservationSummary {
  reservationId: string;
  proposal: NegotiationView;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
}

interface AddressSuggestion {
  id: string;
  label: string;
  detail: string;
  latitude: number | null;
  longitude: number | null;
  source: 'GOOGLE_PLACES' | 'OPENSTREETMAP';
}

type GooglePlacesAutocomplete = new (
  input: HTMLInputElement,
  options?: {
    componentRestrictions?: { country: string };
    fields?: string[];
    types?: string[];
  },
) => {
  addListener: (eventName: 'place_changed', callback: () => void) => void;
  getPlace: () => {
    formatted_address?: string;
    name?: string;
  };
};

type GoogleMapsNamespace = {
  maps?: {
    places?: {
      Autocomplete?: GooglePlacesAutocomplete;
    };
  };
};

@Component({
  selector: 'app-service-proposal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
  ],
  templateUrl: './service-proposal.component.html',
  styleUrl: './service-proposal.component.scss',
})
export class ServiceProposalComponent implements AfterViewChecked, OnDestroy, OnInit {
  @ViewChild('addressInput')
  private readonly addressInput?: ElementRef<HTMLInputElement>;

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
  protected readonly pendingProposal = signal<NegotiationView | null>(null);
  protected readonly isProviderProposalSubmitting = signal(false);
  protected readonly isProviderOfferDirty = signal(false);
  protected readonly acceptedReservation = signal<AcceptedReservationSummary | null>(null);
  protected readonly isCancellingProposal = signal(false);
  protected readonly isRespondingToCounterOffer = signal(false);
  protected readonly mapsSuggestionsReady = signal(false);
  protected readonly mapsSuggestionsUnavailable = signal(false);
  protected readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  protected readonly isLoadingAddressSuggestions = signal(false);
  protected readonly isAddressSuggestionsOpen = signal(false);
  protected readonly isLocatingAddress = signal(false);
  private googleAutocompleteAttached = false;
  private addressSuggestionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private addressSuggestionAbortController: AbortController | null = null;
  private proposalRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly profileId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly negotiationId = this.route.snapshot.queryParamMap.get('negotiationId') || '';
  protected readonly isProviderProposalMode =
    this.route.snapshot.queryParamMap.get('mode') === 'prestataire';
  protected readonly selectedServiceId = signal(
    this.route.snapshot.queryParamMap.get('serviceId') || '',
  );
  protected readonly selectedPayment = signal<PaymentMethod>('WAVE');

  protected readonly appointmentDate = signal(this.toDateInputValue(this.getDefaultAppointmentDate()));
  protected readonly address = signal('');
  protected readonly offerAmount = signal(0);
  protected readonly durationMinutes = 60;
  protected readonly offerSteps = [100, 250, 500];
  protected readonly selectedOfferStep = signal(250);

  protected readonly paymentOptions: PaymentOption[] = [
    { id: 'WAVE', label: 'Wave', mark: 'W', logoUrl: '/wave.png' },
    {
      id: 'ORANGE_MONEY',
      label: 'Orange Money',
      mark: 'OM',
      logoUrl: '/Orange-Money-logo.png',
    },
    { id: 'VISA', label: 'Carte bancaire', mark: 'VISA', logoUrl: '/logo vissa.avif' },
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

  protected readonly avatarUrl = computed(() => this.detail()?.profile.utilisateur.urlAvatar || '');

  protected readonly providerInitials = computed(
    () =>
      this.displayName()
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'JD',
  );
  protected readonly proposalClientName = computed(
    () => this.pendingProposal()?.client?.nom || 'Client',
  );
  protected readonly proposalClientInitials = computed(() =>
    this.proposalClientName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
  protected readonly canProviderRespond = computed(
    () => this.pendingProposal()?.statut === 'EN_ATTENTE_PRESTATAIRE',
  );
  protected readonly providerProposalStatusLabel = computed(() => {
    const status = this.pendingProposal()?.statut;
    if (status === 'EN_ATTENTE_PRESTATAIRE') return 'En attente de votre réponse';
    if (status === 'EN_ATTENTE_CLIENT') return 'Contre-proposition envoyée au client';
    if (status === 'ACCEPTEE') return 'Le prix a été accepté';
    if (status === 'CONVERTIE_EN_RESERVATION') return 'La réservation est confirmée';
    if (status === 'REFUSEE') return 'Proposition refusée';
    if (status === 'ANNULEE') return 'Négociation annulée';
    return 'Proposition de prix';
  });

  protected readonly providerBaseOfferAmount = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return this.currentService()?.prix ?? 0;

    const lastProviderProposal = [...(proposal.propositions ?? [])]
      .reverse()
      .find((item) => item.proposePar === 'PRESTATAIRE' && Number.isFinite(Number(item.montant)));

    return Math.trunc(
      Number(lastProviderProposal?.montant ?? proposal.service?.prix ?? this.currentService()?.prix ?? proposal.montantInitial),
    );
  });
  protected readonly providerBaseOfferLabel = computed(() =>
    this.formatAmount(this.providerBaseOfferAmount()),
  );
  protected readonly providerCurrentClientOfferLabel = computed(() =>
    this.formatAmount(this.pendingProposal()?.montantCourant ?? this.offerAmount()),
  );
  protected readonly providerCounterDifferenceLabel = computed(() => {
    const base = this.providerBaseOfferAmount();
    const amount = Math.trunc(Number(this.offerAmount()));
    if (!base || !Number.isFinite(amount) || amount <= 0) {
      return 'Montant a confirmer avec le client';
    }

    const difference = Math.abs(amount - base);
    if (difference === 0) return 'Votre contre-offre correspond a votre offre';

    const direction = amount < base ? 'moins cher que votre offre' : 'plus cher que votre offre';
    return `${this.formatAmount(difference)} FCFA ${direction}`;
  });
  protected readonly providerCounterActionLabel = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return "Accepter l'offre";
    return Math.trunc(Number(this.offerAmount())) === Math.trunc(Number(proposal.montantCourant))
      ? "Accepter l'offre"
      : 'Proposer au client';
  });
  protected readonly providerSummaryPriceLabel = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return 'OFFRE DU CLIENT';
    if (proposal.statut === 'EN_ATTENTE_CLIENT') return 'VOTRE CONTRE-OFFRE';
    return 'OFFRE DU CLIENT';
  });
  protected readonly providerSummaryAmountLabel = computed(() =>
    this.formatAmount(this.pendingProposal()?.montantCourant ?? this.offerAmount()),
  );
  protected readonly providerProposalFinalized = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return null;
    return proposal.reservationId || proposal.statut === 'CONVERTIE_EN_RESERVATION' ? proposal : null;
  });
  protected readonly providerFinalizedAmountLabel = computed(() =>
    this.formatAmount(
      this.providerProposalFinalized()?.montantAccepte ??
        this.providerProposalFinalized()?.montantCourant ??
        this.offerAmount(),
    ),
  );
  protected readonly providerFinalizedComparisonLabel = computed(() => {
    const base = this.toPositiveAmount(this.providerBaseOfferAmount());
    const accepted = this.toPositiveAmount(
      this.providerProposalFinalized()?.montantAccepte ?? this.providerProposalFinalized()?.montantCourant,
    );

    if (!base || !accepted || base === accepted) return 'Prix initial';
    return accepted < base ? 'Remise accordee' : 'Ajustement';
  });
  protected readonly providerFinalizedComparisonAmountLabel = computed(() => {
    const base = this.toPositiveAmount(this.providerBaseOfferAmount());
    const accepted = this.toPositiveAmount(
      this.providerProposalFinalized()?.montantAccepte ?? this.providerProposalFinalized()?.montantCourant,
    );

    if (!base || !accepted || base === accepted) return '0 FCFA';
    return `${accepted > base ? '+' : '-'}${this.formatAmount(Math.abs(accepted - base))} FCFA`;
  });

  protected readonly categoryLabel = computed(() => this.currentService()?.nom || 'Service Jokko');
  protected readonly isFixedPriceService = computed(
    () => this.currentService()?.typePrix === 'FIXE',
  );
  protected readonly pageTitle = computed(() =>
    this.isFixedPriceService()
      ? "Confirmez votre rendez-vous"
      : "Proposez un prix et choisissez votre rendez-vous",
  );
  protected readonly priceSectionTitle = computed(() =>
    this.isFixedPriceService() ? 'Tarif fixe du service' : 'Proposez un prix au prestataire',
  );
  protected readonly offerFieldLabel = computed(() =>
    this.isFixedPriceService() ? 'Tarif fixe' : 'Votre offre',
  );
  protected readonly summaryPriceLabel = computed(() =>
    this.isFixedPriceService() ? 'PRIX FIXE' : 'PRIX PROPOSE',
  );
  protected readonly checkoutTotalLabel = computed(() =>
    this.isFixedPriceService() ? 'TOTAL A PAYER' : 'TOTAL A AUTORISER',
  );
  protected readonly submitButtonLabel = computed(() => {
    if (this.isSubmitting()) {
      return this.isFixedPriceService() ? 'Creation du rendez-vous...' : 'Envoi en cours...';
    }

    return this.isFixedPriceService() ? 'Confirmer le rendez-vous' : 'Envoyer la proposition';
  });

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

  protected readonly formattedTime = computed(() => {
    const date = new Date(this.appointmentDate());
    if (Number.isNaN(date.getTime())) return 'Heure a choisir';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replace(':', 'h');
  });

  protected readonly initialPriceLabel = computed(() => {
    const price = this.currentService()?.prix ?? 0;
    return price > 0 ? `${this.formatAmount(price)} FCFA` : 'A definir';
  });

  protected readonly offerDifferenceLabel = computed(() => {
    const servicePrice = Number(this.currentService()?.prix ?? 0);
    const offer = Number(this.offerAmount());

    if (!Number.isFinite(servicePrice) || servicePrice <= 0 || !Number.isFinite(offer) || offer <= 0) {
      return 'Montant a confirmer avec le prestataire';
    }

    const difference = Math.trunc(Math.abs(offer - servicePrice));
    if (difference === 0) {
      return "Votre offre correspond au prix initial du service";
    }

    const direction = offer < servicePrice ? "moins cher que l'offre du prestataire" : "plus que l'offre du prestataire";
    return `${this.formatAmount(difference)} FCFA ${direction}`;
  });

  protected readonly shortAddress = computed(() => this.truncate(this.address(), 28));
  protected readonly formattedOffer = computed(() => this.formatAmount(this.offerAmount()));
  protected readonly pendingOfferAmountLabel = computed(() => {
    const proposal = this.pendingProposal();
    return this.formatAmount(proposal?.montantCourant ?? this.offerAmount());
  });
  protected readonly hasProviderCounterOffer = computed(
    () => this.pendingProposal()?.statut === 'EN_ATTENTE_CLIENT',
  );
  protected readonly initialOfferAmountLabel = computed(() =>
    this.formatAmount(this.pendingProposal()?.montantInitial ?? this.offerAmount()),
  );
  protected readonly providerCounterAmountLabel = computed(() =>
    this.formatAmount(this.pendingProposal()?.montantCourant ?? this.offerAmount()),
  );
  protected readonly counterDifferenceLabel = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return '';
    const difference = Math.trunc(proposal.montantCourant - proposal.montantInitial);
    if (difference === 0) return 'La proposition correspond a votre offre initiale';

    const direction = difference > 0 ? 'de plus que votre offre' : 'de moins que votre offre';
    return `${this.formatAmount(Math.abs(difference))} FCFA ${direction}`;
  });
  protected readonly counterActionLabel = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return "valider l'offre";
    return this.offerAmount() === proposal.montantCourant ? "valider l'offre" : 'Envoyer ma contre-offre';
  });
  protected readonly acceptedAmountLabel = computed(() =>
    this.formatAmount(this.acceptedReservation()?.proposal.montantCourant ?? this.offerAmount()),
  );
  protected readonly acceptedTotalLabel = computed(() =>
    `${this.formatAmount(this.acceptedReservation()?.proposal.montantCourant ?? this.offerAmount())} FCFA`,
  );
  protected readonly acceptedDateTimeLabel = computed(() => {
    const accepted = this.acceptedReservation();
    return accepted ? this.formatAcceptedDateTime(accepted.dateHeure) : `${this.formattedDate()} a ${this.formattedTime()}`;
  });
  protected readonly acceptedDateLabel = computed(() => {
    const accepted = this.acceptedReservation();
    return accepted ? this.formatAcceptedDate(accepted.dateHeure) : this.formattedDate();
  });
  protected readonly acceptedTimeLabel = computed(() => {
    const accepted = this.acceptedReservation();
    return accepted ? this.formatAcceptedTime(accepted.dateHeure) : this.formattedTime();
  });
  protected readonly acceptedAddressLabel = computed(() =>
    this.acceptedReservation()?.adresseClient || this.address().trim() || 'Adresse a confirmer',
  );
  protected readonly acceptedComparisonLabel = computed(() => {
    const servicePrice = this.toPositiveAmount(this.currentService()?.prix);
    const acceptedAmount = this.toPositiveAmount(this.acceptedReservation()?.proposal.montantCourant);

    if (!servicePrice) {
      return 'Prix initial';
    }

    if (!acceptedAmount || servicePrice === acceptedAmount) {
      return 'Difference';
    }

    return acceptedAmount < servicePrice ? 'Economie' : 'Ajustement';
  });
  protected readonly acceptedComparisonAmountLabel = computed(() => {
    const servicePrice = this.toPositiveAmount(this.currentService()?.prix);
    const acceptedAmount = this.toPositiveAmount(this.acceptedReservation()?.proposal.montantCourant);

    if (!servicePrice) {
      return 'A confirmer';
    }

    if (!acceptedAmount || servicePrice === acceptedAmount) {
      return '0 FCFA';
    }

    const difference = Math.abs(servicePrice - acceptedAmount);
    return `+${this.formatAmount(difference)} FCFA`;
  });
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

  ngAfterViewChecked(): void {
    if (this.addressInput && environment.googleMapsApiKey && !this.googleAutocompleteAttached) {
      this.initializeAddressSuggestions();
    }
  }

  ngOnDestroy(): void {
    if (this.availabilityCheckTimeoutId) {
      clearTimeout(this.availabilityCheckTimeoutId);
    }

    if (this.addressSuggestionTimeoutId) {
      clearTimeout(this.addressSuggestionTimeoutId);
    }

    this.addressSuggestionAbortController?.abort();
    this.stopProposalRefresh();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected selectPayment(method: PaymentMethod): void {
    this.selectedPayment.set(method);
  }

  protected updateOfferAmount(value: number | string): void {
    const amount = Number(String(value).replace(/[^\d]/g, ''));
    this.offerAmount.set(Number.isFinite(amount) ? amount : 0);
    if (this.isProviderProposalMode && this.canProviderRespond()) {
      this.isProviderOfferDirty.set(true);
    }
  }

  protected respondToClientProposal(): void {
    const proposal = this.pendingProposal();
    const amount = Math.trunc(Number(this.offerAmount()));
    if (!proposal || !this.canProviderRespond() || this.isProviderProposalSubmitting()) return;

    if (amount === Math.trunc(Number(proposal.montantCourant))) {
      this.acceptClientProposal();
      return;
    }

    this.submitProviderCounterOffer();
  }

  protected submitProviderCounterOffer(): void {
    const proposal = this.pendingProposal();
    const amount = Math.trunc(Number(this.offerAmount()));
    if (!proposal || !this.canProviderRespond() || this.isProviderProposalSubmitting()) return;
    if (!Number.isFinite(amount) || amount < 500 || amount > 10_000_000) {
      this.feedback.info('Renseignez un montant entre 500 et 10 000 000 FCFA.');
      return;
    }
    if (amount === Math.trunc(proposal.montantCourant)) {
      this.feedback.info('La contre-proposition doit être différente du montant proposé par le client.');
      return;
    }

    this.isProviderProposalSubmitting.set(true);
    this.proposalService
      .counterPriceProposal(proposal.id, {
        serviceId: proposal.serviceId,
        proposedAmount: amount,
        message: `Contre-proposition du prestataire: ${this.formatAmount(amount)} FCFA.`,
        dateHeure: proposal.dateHeureProposee || undefined,
        adresseClient: proposal.adresseClientProposee || undefined,
        dureeMinutes: proposal.dureeMinutesProposee || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.pendingProposal.set(updated);
          this.offerAmount.set(updated.montantCourant);
          this.isProviderOfferDirty.set(false);
          this.isProviderProposalSubmitting.set(false);
          this.feedback.success('Votre contre-proposition a été envoyée au client.');
          this.startProposalRefresh(updated.id);
        },
        error: (error) => {
          this.isProviderProposalSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  protected acceptClientProposal(): void {
    const proposal = this.pendingProposal();
    if (!proposal || !this.canProviderRespond() || this.isProviderProposalSubmitting()) return;

    this.isProviderProposalSubmitting.set(true);
    this.proposalService.acceptPriceProposal(proposal.id).subscribe({
      next: (updated) => {
        this.pendingProposal.set(updated);
        this.offerAmount.set(updated.montantCourant);
        this.isProviderOfferDirty.set(false);
        this.isProviderProposalSubmitting.set(false);
        this.feedback.success('Le prix proposé par le client a été accepté.');
        this.startProposalRefresh(updated.id);
      },
      error: (error) => {
        this.isProviderProposalSubmitting.set(false);
        this.handleProposalError(error);
      },
    });
  }

  protected rejectClientProposal(): void {
    const proposal = this.pendingProposal();
    if (!proposal || !this.canProviderRespond() || this.isProviderProposalSubmitting()) return;

    this.isProviderProposalSubmitting.set(true);
    this.proposalService.rejectPriceProposal(proposal.id, 'Proposition refusée par le prestataire.').subscribe({
      next: (updated) => {
        this.pendingProposal.set(updated);
        this.isProviderOfferDirty.set(false);
        this.isProviderProposalSubmitting.set(false);
        this.feedback.success('La proposition a été refusée.');
      },
      error: (error) => {
        this.isProviderProposalSubmitting.set(false);
        this.handleProposalError(error);
      },
    });
  }

  protected selectOfferStep(step: number): void {
    this.selectedOfferStep.set(step);
  }

  protected decreaseOffer(): void {
    if (this.isFixedPriceService()) {
      return;
    }

    const nextAmount = Math.max(500, Math.trunc(this.offerAmount() - this.selectedOfferStep()));
    this.offerAmount.set(nextAmount);
    if (this.isProviderProposalMode && this.canProviderRespond()) {
      this.isProviderOfferDirty.set(true);
    }
  }

  protected increaseOffer(): void {
    if (this.isFixedPriceService()) {
      return;
    }

    const nextAmount = Math.min(10_000_000, Math.trunc(this.offerAmount() + this.selectedOfferStep()));
    this.offerAmount.set(nextAmount);
    if (this.isProviderProposalMode && this.canProviderRespond()) {
      this.isProviderOfferDirty.set(true);
    }
  }

  protected messageProvider(): void {
    if (!this.authSession.getAccessToken()) {
      this.feedback.info('Connectez-vous d abord pour ecrire au prestataire.');
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    const service = this.currentService();
    if (!service?.profilProfessionnelId) {
      this.feedback.error('Impossible d ouvrir la discussion avec ce prestataire.');
      return;
    }

    this.messagesService.createConversation({ professionalProfileId: service.profilProfessionnelId }).subscribe({
      next: (conversation) => {
        this.router.navigate(['/messages'], {
          queryParams: {
            conversationId: conversation.id,
            professionalId: service.profilProfessionnelId,
            providerName: this.displayName(),
            serviceName: service.nom || this.categoryLabel(),
          },
        });
      },
      error: (error) => this.handleProposalError(error),
    });
  }

  protected cancelPendingProposal(): void {
    const proposal = this.pendingProposal();
    if (!proposal || this.isCancellingProposal()) {
      return;
    }

    this.isCancellingProposal.set(true);
    this.proposalService.cancelPriceProposal(proposal.id, 'Annulation demandee par le client.').subscribe({
      next: () => {
        this.feedback.success("Votre offre a ete annulee.");
        this.pendingProposal.set(null);
        this.stopProposalRefresh();
        this.isCancellingProposal.set(false);
      },
      error: (error) => {
        this.isCancellingProposal.set(false);
        this.handleProposalError(error);
      },
    });
  }

  protected respondToProviderCounterOffer(): void {
    const proposal = this.pendingProposal();
    const service = this.currentService();
    if (!proposal || !service || this.isRespondingToCounterOffer()) {
      return;
    }

    const amount = Math.trunc(Number(this.offerAmount()));
    if (!Number.isFinite(amount) || amount < 500 || amount > 10_000_000) {
      this.feedback.info('Renseignez un montant entre 500 et 10 000 000 FCFA.');
      return;
    }

    if (amount !== proposal.montantCourant) {
      this.sendClientCounterOffer(proposal, service, amount);
      return;
    }

    this.acceptProviderCounterOffer(proposal);
  }

  protected refuseProviderCounterOffer(): void {
    const proposal = this.pendingProposal();
    if (!proposal || this.isCancellingProposal()) {
      return;
    }

    this.isCancellingProposal.set(true);
    this.proposalService
      .cancelPriceProposal(proposal.id, 'Contre-proposition refusee par le client.')
      .subscribe({
        next: () => {
          this.feedback.success('La proposition du prestataire a ete refusee.');
          this.pendingProposal.set(null);
          this.stopProposalRefresh();
          this.isCancellingProposal.set(false);
        },
        error: (error) => {
          this.isCancellingProposal.set(false);
          this.handleProposalError(error);
        },
      });
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

  protected initializeAddressSuggestions(): void {
    if (!environment.googleMapsApiKey) {
      this.mapsSuggestionsReady.set(true);
      this.mapsSuggestionsUnavailable.set(false);
      return;
    }

    if (this.googleAutocompleteAttached || this.mapsSuggestionsReady()) {
      return;
    }

    this.loadGoogleMapsPlacesScript()
      .then(() => {
        const input = this.addressInput?.nativeElement;
        const autocompleteCtor = this.getGooglePlacesAutocomplete();
        if (!input || !autocompleteCtor) {
          this.mapsSuggestionsUnavailable.set(true);
          return;
        }

        const autocomplete = new autocompleteCtor(input, {
          componentRestrictions: { country: 'sn' },
          fields: ['formatted_address', 'name'],
          types: ['geocode', 'establishment'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const label = (place.formatted_address || place.name || input.value).trim();
          if (label) {
            this.address.set(label);
          }
        });

        this.googleAutocompleteAttached = true;
        this.mapsSuggestionsReady.set(true);
        this.mapsSuggestionsUnavailable.set(false);
      })
      .catch(() => this.mapsSuggestionsUnavailable.set(true));
  }

  protected handleAddressFocus(): void {
    this.initializeAddressSuggestions();
    const query = this.address().trim();
    if (query.length >= 1 && this.addressSuggestions().length > 0) {
      this.isAddressSuggestionsOpen.set(true);
    }
  }

  protected updateAddress(value: string): void {
    this.address.set(value);
    this.initializeAddressSuggestions();
    this.scheduleOpenStreetMapAddressSuggestions(value);
  }

  protected selectAddressSuggestion(suggestion: AddressSuggestion): void {
    this.address.set(suggestion.label);
    this.addressSuggestions.set([]);
    this.isAddressSuggestionsOpen.set(false);
  }

  protected closeAddressSuggestionsSoon(): void {
    setTimeout(() => this.isAddressSuggestionsOpen.set(false), 160);
  }

  protected useCurrentLocationForAddress(): void {
    if (!navigator.geolocation) {
      this.feedback.info('La geolocalisation nest pas disponible sur cet appareil.');
      return;
    }

    this.isLocatingAddress.set(true);
    this.feedback.info('Autorisez le partage de votre position pour renseigner votre adresse exacte.');

    let bestPosition: GeolocationPosition | null = null;
    let completed = false;
    let watchId: number | null = null;
    const idealAccuracyMeters = 35;

    const stopWatching = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const finishWithBestPosition = () => {
      if (completed) {
        return;
      }

      completed = true;
      stopWatching();

      if (!bestPosition) {
        this.isLocatingAddress.set(false);
        this.feedback.info('Impossible de recuperer une position precise pour le moment.');
        return;
      }

      const { latitude, longitude, accuracy } = bestPosition.coords;
      const gpsLabel = this.formatExactGpsLabel(latitude, longitude, accuracy);

      this.resolveOpenStreetMapAddressFromCoordinates(latitude, longitude)
        .then((label) => {
          this.address.set(label ? `${label} - ${gpsLabel}` : gpsLabel);
          this.addressSuggestions.set([]);
          this.isAddressSuggestionsOpen.set(false);
          this.feedback.success(
            accuracy
              ? `Position exacte recuperee avec une precision d'environ ${Math.round(accuracy)} m.`
              : 'Position exacte recuperee.',
          );
        })
        .catch(() => {
          this.address.set(gpsLabel);
          this.feedback.info('Position exacte recuperee. Le nom de la localisation nest pas disponible.');
        })
        .finally(() => this.isLocatingAddress.set(false));
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (
          !bestPosition ||
          position.coords.accuracy < bestPosition.coords.accuracy
        ) {
          bestPosition = position;
        }

        if (position.coords.accuracy <= idealAccuracyMeters) {
          finishWithBestPosition();
        }
      },
      () => {
        this.isLocatingAddress.set(false);
        stopWatching();
        this.feedback.info('Autorisez la localisation precise pour renseigner automatiquement votre adresse.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );

    setTimeout(finishWithBestPosition, 15_000);
  }

  protected selectAvailabilitySlot(slot: ReservationAvailabilitySlotView): void {
    if (!slot.available) {
      this.feedback.info(slot.reason || 'Ce creneau nest pas disponible.');
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
      this.feedback.info('Connectez-vous d abord pour proposer un prix.');
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
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
          if (hasExistingHistory) {
            this.feedback.info('Une discussion est deja ouverte pour ce service.');
          } else {
            this.feedback.success('Votre proposition a ete envoyee au prestataire.');
          }
          this.showPendingProposal(proposal, draft);
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
    if (activeProposal.statut !== 'EN_ATTENTE_CLIENT') {
      this.feedback.info('Une proposition est deja en attente de reponse du prestataire.');
      this.showPendingProposal(activeProposal, draft);
      return;
    }

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
          this.showPendingProposal(proposal, draft);
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
        next: (reservation) => {
          this.feedback.success('Votre rendez-vous a ete cree avec succes.');
          if (reservation.id) {
            this.router.navigate(['/appointments', reservation.id, 'payment']);
            return;
          }

          this.router.navigate(['/appointments']);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private showPendingProposal(proposal: NegotiationView, draft: ReservationDraft): void {
    this.acceptedReservation.set(null);
    this.pendingProposal.set(proposal);
    this.offerAmount.set(proposal.montantCourant || draft.amount);
    if (proposal.statut === 'EN_ATTENTE_CLIENT') {
      this.selectedOfferStep.set(1000);
    }
    if (proposal.dateHeureProposee) {
      this.appointmentDate.set(this.toDateInputValue(new Date(proposal.dateHeureProposee)));
    }
    if (proposal.adresseClientProposee?.trim()) {
      this.address.set(proposal.adresseClientProposee.trim());
    }
    this.isSubmitting.set(false);
    this.startProposalRefresh(proposal.id);
  }

  private acceptProviderCounterOffer(proposal: NegotiationView): void {
    this.isRespondingToCounterOffer.set(true);
    this.proposalService.acceptPriceProposal(proposal.id).subscribe({
      next: (acceptedProposal) => {
        this.pendingProposal.set(acceptedProposal);
        this.createReservationFromAcceptedNegotiation(acceptedProposal);
      },
      error: (error) => {
        this.isRespondingToCounterOffer.set(false);
        this.handleProposalError(error);
      },
    });
  }

  private sendClientCounterOffer(
    proposal: NegotiationView,
    service: BackendProfessionalDetailService,
    amount: number,
  ): void {
    this.isRespondingToCounterOffer.set(true);
    this.proposalService
      .counterPriceProposal(proposal.id, {
        serviceId: service.id,
        proposedAmount: amount,
        message: this.buildProposalMessage({
          service,
          amount,
          dateHeure: this.toIsoDateTime(this.appointmentDate()) ?? proposal.dateHeureProposee ?? '',
          adresseClient: this.address().trim() || proposal.adresseClientProposee || '',
          dureeMinutes: this.durationMinutes,
          paymentMethod: this.selectedPayment(),
        }),
        dateHeure: this.toIsoDateTime(this.appointmentDate()) ?? proposal.dateHeureProposee ?? undefined,
        adresseClient: this.address().trim() || proposal.adresseClientProposee || undefined,
        dureeMinutes: this.durationMinutes,
      })
      .subscribe({
        next: (updatedProposal) => {
          this.pendingProposal.set(updatedProposal);
          this.offerAmount.set(updatedProposal.montantCourant);
          this.feedback.success('Votre contre-offre a ete envoyee au prestataire.');
          this.isRespondingToCounterOffer.set(false);
          this.startProposalRefresh(updatedProposal.id);
        },
        error: (error) => {
          this.isRespondingToCounterOffer.set(false);
          this.handleProposalError(error);
        },
      });
  }

  private createReservationFromAcceptedNegotiation(proposal: NegotiationView): void {
    const dateHeure = proposal.dateHeureProposee || this.toIsoDateTime(this.appointmentDate());
    const adresseClient = proposal.adresseClientProposee || this.address().trim();
    const dureeMinutes = proposal.dureeMinutesProposee || this.durationMinutes;

    if (!dateHeure || !adresseClient) {
      this.isRespondingToCounterOffer.set(false);
      this.feedback.error('Date ou adresse manquante pour creer la reservation.');
      return;
    }

    this.proposalService
      .createReservationFromNegotiation({
        negotiationId: proposal.id,
        dateHeure,
        adresseClient,
        dureeMinutes,
        notes: `Reservation creee apres acceptation du prix propose: ${this.formatAmount(proposal.montantCourant)} FCFA.`,
      })
      .subscribe({
        next: (reservation) => {
          const reservationId = reservation.id;
          this.isRespondingToCounterOffer.set(false);
          this.stopProposalRefresh();
          this.feedback.success('Offre acceptee. Vous pouvez finaliser le paiement.');
          if (!reservationId) {
            this.feedback.error('Reservation creee, mais identifiant de paiement manquant.');
            return;
          }

          this.acceptedReservation.set({
            reservationId,
            proposal,
            dateHeure,
            adresseClient,
            dureeMinutes,
          });
        },
        error: (error) => {
          this.isRespondingToCounterOffer.set(false);
          this.handleProposalError(error);
        },
      });
  }

  protected payAcceptedReservation(): void {
    const accepted = this.acceptedReservation();
    if (!accepted?.reservationId) {
      this.feedback.error('Impossible de retrouver cette reservation pour le paiement.');
      return;
    }

    this.router.navigate(['/appointments', accepted.reservationId, 'payment']);
  }

  protected openProviderFinalizedReservation(): void {
    const reservationId = this.providerProposalFinalized()?.reservationId;
    if (!reservationId) {
      this.feedback.info('La reservation est en cours de finalisation.');
      return;
    }

    this.router.navigate(['/appointments', reservationId]);
  }

  private startProposalRefresh(negotiationId: string): void {
    this.stopProposalRefresh();
    this.proposalRefreshIntervalId = setInterval(() => {
      this.refreshPendingProposal(negotiationId);
    }, 5000);
  }

  private stopProposalRefresh(): void {
    if (this.proposalRefreshIntervalId) {
      clearInterval(this.proposalRefreshIntervalId);
      this.proposalRefreshIntervalId = null;
    }
  }

  private refreshPendingProposal(negotiationId: string): void {
    this.proposalService.getPriceProposal(negotiationId).subscribe({
      next: (proposal) => {
        const previous = this.pendingProposal();
        this.pendingProposal.set(proposal);
        const shouldKeepProviderDraft =
          this.isProviderProposalMode &&
          this.isProviderOfferDirty() &&
          proposal.statut === 'EN_ATTENTE_PRESTATAIRE';
        if (
          !shouldKeepProviderDraft &&
          !(proposal.statut === 'EN_ATTENTE_CLIENT' && previous?.statut === 'EN_ATTENTE_CLIENT')
        ) {
          this.offerAmount.set(proposal.montantCourant);
        }
        if (proposal.statut === 'EN_ATTENTE_CLIENT' && previous?.statut !== 'EN_ATTENTE_CLIENT') {
          this.selectedOfferStep.set(1000);
        }
        if (proposal.dateHeureProposee) {
          this.appointmentDate.set(this.toDateInputValue(new Date(proposal.dateHeureProposee)));
        }
        if (proposal.adresseClientProposee?.trim()) {
          this.address.set(proposal.adresseClientProposee.trim());
        }

        if (
          !this.isProviderProposalMode &&
          proposal.statut === 'ACCEPTEE' &&
          previous?.statut !== 'ACCEPTEE' &&
          !proposal.reservationId &&
          !this.isRespondingToCounterOffer()
        ) {
          this.isRespondingToCounterOffer.set(true);
          this.createReservationFromAcceptedNegotiation(proposal);
          return;
        }

        if (
          proposal.statut === 'ACCEPTEE' ||
          proposal.statut === 'REFUSEE' ||
          proposal.statut === 'ANNULEE' ||
          proposal.statut === 'CONVERTIE_EN_RESERVATION'
        ) {
          this.stopProposalRefresh();
        }
      },
      error: () => {
        this.stopProposalRefresh();
      },
    });
  }

  private handleProposalError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const errorCode = (error.error as { errorCode?: string } | undefined)?.errorCode;

      if (error.status === 401) {
        this.feedback.info('Votre session a expire. Connectez-vous pour continuer.');
        this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl: this.router.url },
        });
        return;
      }

      if (errorCode === 'NEGOTIATIONS_ALREADY_ACTIVE') {
        this.feedback.info('Une proposition de prix est deja ouverte pour ce service.');
        const service = this.currentService();
        if (service) {
          this.proposalService.findActiveProposalForService(service.id).subscribe({
            next: (proposal) => {
              this.isSubmitting.set(false);
              if (proposal) {
                this.showPendingProposal(
                  proposal,
                  this.buildFallbackReservationDraft(service, this.offerAmount()),
                );
                return;
              }

              this.feedback.error('Impossible de retrouver la proposition active.');
            },
            error: () => {
              this.isSubmitting.set(false);
              this.feedback.error('Impossible de retrouver la proposition active.');
            },
          });
          return;
        }
        this.isSubmitting.set(false);
        return;
      }
    }

    this.feedback.error(
      getHttpErrorMessage(error, "Impossible d'envoyer cette proposition pour le moment."),
    );
  }

  private loadDetail(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      detail: this.servicesService.getProviderProfileDetail(this.profileId),
      proposal: this.isProviderProposalMode && this.negotiationId
        ? this.proposalService.getPriceProposal(this.negotiationId)
        : of(null as NegotiationView | null),
      user: this.authSession.hasAuthenticatedSession()
        ? this.authService.myUserProfile().pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ detail, proposal, user }) => {
        this.detail.set(detail);
        if (proposal) {
          this.pendingProposal.set(proposal);
          this.selectedServiceId.set(proposal.serviceId);
          this.offerAmount.set(proposal.montantCourant);
          this.isProviderOfferDirty.set(false);
          this.selectedOfferStep.set(1000);
          this.address.set(
            proposal.adresseClientProposee || proposal.client?.adresse || '',
          );
          if (proposal.dateHeureProposee) {
            this.appointmentDate.set(this.toDateInputValue(new Date(proposal.dateHeureProposee)));
          }
        } else {
          const service = this.currentService();
          this.selectedServiceId.set(service?.id || '');
          this.offerAmount.set(service?.prix ?? 0);
          this.address.set(user?.adresse?.trim() || this.resolveInitialAddress(detail));
        }
        this.isLoading.set(false);
        if (proposal) {
          this.startProposalRefresh(proposal.id);
        }
        if (!this.isProviderProposalMode) {
          this.scheduleAvailabilityCheck();
        }
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
      this.feedback.error('Impossible d ouvrir la discussion avec ce prestataire.');
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
      this.feedback.info('Selectionnez un service valide avant de confirmer.');
      return null;
    }

    const amount = service.typePrix === 'FIXE'
      ? Math.trunc(Number(service.prix))
      : Math.trunc(Number(this.offerAmount()));
    if (service.typePrix === 'FIXE' && (!Number.isFinite(amount) || amount <= 0)) {
      this.feedback.info('Ce service fixe doit avoir un tarif renseigne avant la reservation.');
      return null;
    }

    if (
      service.typePrix === 'NEGOCIABLE' &&
      (!Number.isFinite(amount) || amount < 500 || amount > 10_000_000)
    ) {
      this.feedback.info('Renseignez un montant entre 500 et 10 000 000 FCFA.');
      return null;
    }

    const dateHeure = this.toIsoDateTime(this.appointmentDate());
    if (!dateHeure || !this.isValidAppointmentDate()) {
      this.feedback.info('Choisissez une date et une heure future pour le rendez-vous.');
      return null;
    }

    if (this.isCheckingAvailability() || this.isLoadingAvailabilitySlots()) {
      this.feedback.info('Patientez pendant la verification des creneaux.');
      return null;
    }

    const availabilityStatus = this.availabilityStatus();
    if (!availabilityStatus || availabilityStatus.dateHeure !== dateHeure) {
      this.feedback.info('Verifiez la disponibilite du creneau avant de confirmer.');
      this.checkAvailabilityNow(service, dateHeure);
      return null;
    }

    if (!availabilityStatus.available) {
      this.feedback.info(availabilityStatus.reason || 'Ce creneau nest pas disponible.');
      return null;
    }

    const adresseClient = this.address().trim().replace(/\s+/g, ' ');
    if (adresseClient.length < 5 || adresseClient.length > 180) {
      this.feedback.info('Renseignez une adresse precise entre 5 et 180 caracteres.');
      return null;
    }

    if (!Number.isInteger(this.durationMinutes) || this.durationMinutes < 15 || this.durationMinutes > 1440) {
      this.feedback.info('La duree du rendez-vous est invalide.');
      return null;
    }

    const paymentMethod = this.selectedPayment();
    if (!this.paymentOptions.some((payment) => payment.id === paymentMethod)) {
      this.feedback.info('Selectionnez un moyen de paiement valide.');
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

  private loadGoogleMapsPlacesScript(): Promise<void> {
    if (this.getGooglePlacesAutocomplete()) {
      return Promise.resolve();
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-jokko-google-maps-places="true"]',
    );
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsApiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset['jokkoGoogleMapsPlaces'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }

  private getGooglePlacesAutocomplete(): GooglePlacesAutocomplete | undefined {
    return (window.google as unknown as GoogleMapsNamespace | undefined)?.maps?.places?.Autocomplete;
  }

  private scheduleOpenStreetMapAddressSuggestions(value: string): void {
    const query = value.trim().replace(/\s+/g, ' ');

    if (this.addressSuggestionTimeoutId) {
      clearTimeout(this.addressSuggestionTimeoutId);
    }

    if (query.length < 1) {
      this.addressSuggestionAbortController?.abort();
      this.addressSuggestions.set([]);
      this.isAddressSuggestionsOpen.set(false);
      this.isLoadingAddressSuggestions.set(false);
      return;
    }

    this.addressSuggestionTimeoutId = setTimeout(() => {
      this.loadOpenStreetMapAddressSuggestions(query);
    }, 320);
  }

  private loadOpenStreetMapAddressSuggestions(query: string): void {
    this.addressSuggestionAbortController?.abort();
    const controller = new AbortController();
    this.addressSuggestionAbortController = controller;
    this.isLoadingAddressSuggestions.set(true);

    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'sn',
      limit: '6',
      q: query,
    });

    fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((items: unknown) => {
        if (!Array.isArray(items)) {
          this.addressSuggestions.set([]);
          this.isAddressSuggestionsOpen.set(false);
          return;
        }

        const suggestions = items
          .map((item, index) => this.mapOpenStreetMapSuggestion(item, index))
          .filter((item): item is AddressSuggestion => item !== null);

        this.addressSuggestions.set(suggestions);
        this.isAddressSuggestionsOpen.set(suggestions.length > 0);
        this.mapsSuggestionsReady.set(true);
        this.mapsSuggestionsUnavailable.set(false);
      })
      .catch((error) => {
        if ((error as { name?: string })?.name === 'AbortError') {
          return;
        }

        this.addressSuggestions.set([]);
        this.isAddressSuggestionsOpen.set(false);
        this.mapsSuggestionsUnavailable.set(true);
      })
      .finally(() => {
        if (this.addressSuggestionAbortController === controller) {
          this.isLoadingAddressSuggestions.set(false);
        }
      });
  }

  private mapOpenStreetMapSuggestion(item: unknown, index: number): AddressSuggestion | null {
    const value = item as {
      place_id?: number | string;
      display_name?: string;
      name?: string;
      lat?: string;
      lon?: string;
      type?: string;
      address?: {
        amenity?: string;
        road?: string;
        quarter?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };

    const address = value.address ?? {};
    const label = this.cleanAddressPart(
      value.name ||
        address.amenity ||
        address.road ||
        address.quarter ||
        address.neighbourhood ||
        address.suburb ||
        address.city ||
        address.town ||
        address.village ||
        value.display_name?.split(',')[0],
    );
    if (!label) {
      return null;
    }

    const detailParts = [
      address.neighbourhood,
      address.suburb,
      address.city || address.town || address.village,
      address.state,
    ]
      .map((part) => this.cleanAddressPart(part))
      .filter((part, partIndex, parts): part is string => Boolean(part) && parts.indexOf(part) === partIndex && part !== label);
    const detail = detailParts.slice(0, 2).join(' - ') || 'Senegal';
    const latitude = Number(value.lat);
    const longitude = Number(value.lon);

    return {
      id: String(value.place_id ?? `${label}-${index}`),
      label,
      detail: detail || value.type || 'Adresse au Senegal',
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      source: 'OPENSTREETMAP',
    };
  }

  private resolveOpenStreetMapAddressFromCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      addressdetails: '1',
      zoom: '18',
    });

    return fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((item: unknown) => {
        const value = item as {
          display_name?: string;
          name?: string;
          address?: {
            amenity?: string;
            road?: string;
            quarter?: string;
            neighbourhood?: string;
            suburb?: string;
            city?: string;
            town?: string;
            village?: string;
            state?: string;
            country?: string;
          };
        };

        const address = value.address ?? {};
        const locality = [
          address.amenity,
          address.road,
          address.quarter,
          address.neighbourhood,
          address.suburb,
          address.city || address.town || address.village,
          address.state,
        ]
          .map((part) => this.cleanAddressPart(part))
          .filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index)
          .slice(0, 4)
          .join(', ');

        return locality || this.cleanAddressPart(value.display_name) || '';
      });
  }

  private formatExactGpsLabel(latitude: number, longitude: number, accuracy: number | null): string {
    const precision = Number.isFinite(Number(accuracy))
      ? `, precision ${Math.round(Number(accuracy))} m`
      : '';
    return `Position GPS exacte: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${precision}`;
  }

  private cleanAddressPart(value: string | null | undefined): string {
    return (value || '')
      .replace(/\b(commune|communes|arrondissement|arrondissements|departement|region)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,-]+|[\s,-]+$/g, '')
      .trim();
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

  protected formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
      .format(value || 0)
      .replace(/\s/g, ' ');
  }

  private toPositiveAmount(value: number | null | undefined): number | null {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : null;
  }

  private formatAcceptedDateTime(value: string): string {
    return `${this.formatAcceptedDate(value)} a ${this.formatAcceptedTime(value)}`;
  }

  private formatAcceptedDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .replace('.', '');
  }

  private formatAcceptedTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Heure a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replace(':', 'h');
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 4)}....` : value;
  }
}
