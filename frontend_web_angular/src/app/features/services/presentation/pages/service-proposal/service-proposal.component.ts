import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  GoogleMapsCoordinate,
  GoogleMapsLoaderService,
} from '../../../../../shared/maps/google-maps-loader.service';
import { safeInternalUrl } from '../../../../../shared/utils/safe-internal-url';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { AuthService } from '../../../../auth/data-access/auth.service';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import {
  AvailabilityRealtimeService,
  ProfessionalAvailabilityChangedEvent,
} from '../../../data-access/availability-realtime.service';
import {
  CreateReservationFromNegotiationPayload,
  NegotiationView,
  MaterialQuoteView,
  ProposalReservationStatus,
  ReservationAvailabilitySlotView,
  ReservationAvailabilityView,
  ServiceProposalService,
} from '../../../data-access/service-proposal.service';
import { ServicesService } from '../../../data-access/services.service';
import {
  BackendProfessionalDetailService,
  ProfessionalVehicleType,
  ProviderProfileDetail,
} from '../../../domain/models/services.models';
import {
  ProposalDetailsModal,
  ServiceProposalDetailsModalComponent,
} from '../../components/service-proposal-details-modal/service-proposal-details-modal.component';
import { ServiceProposalAcceptedSummaryComponent } from '../../components/service-proposal-accepted-summary/service-proposal-accepted-summary.component';
import { ServiceProposalFormatService } from './service-proposal-format.service';
import {
  MaterialQuoteAuthor,
  MaterialQuoteDraft,
  MaterialQuoteEntry,
  ServiceProposalMaterialQuoteService,
} from './service-proposal-material-quote.service';
import {
  ParcelContactDraft,
  ParcelDraft,
  ServiceProposalParcelService,
} from './service-proposal-parcel.service';
import { ServiceProposalPricingViewService } from './service-proposal-pricing-view.service';
import {
  AcceptedReservationSummary,
  PaymentMethod,
  ReservationDraft,
  ServiceProposalReservationBuilderService,
} from './service-proposal-reservation-builder.service';
import { ServiceProposalStateService } from './service-proposal-state.service';
import { ServiceProposalUiService } from './service-proposal-ui.service';

const PROFESSIONAL_VEHICLE_BADGES: Record<
  ProfessionalVehicleType,
  { label: string; imageUrl: string }
> = {
  MOTO_SCOOTER: {
    label: 'Moto / Scooter',
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/moto.png',
  },
  VOITURE: {
    label: 'Voiture',
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/voiture.png',
  },
  CAMIONNETTE: {
    label: 'Camionnette',
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/camionnette.png',
  },
};

type ClientBookingStep = 'DETAILS' | 'PRICE';
type ClientDetailsField =
  | 'service'
  | 'schedule'
  | 'address'
  | 'availability'
  | 'parcels'
  | 'pickupAddress'
  | 'pickupContact'
  | 'dropoffAddress'
  | 'dropoffContact';

interface AddressSuggestion {
  id: string;
  label: string;
  detail: string;
  latitude: number | null;
  longitude: number | null;
  source: 'GOOGLE_PLACES' | 'OPENSTREETMAP';
}

interface ServiceProposalClientDraft {
  selectedServiceId: string;
  customServiceName: string;
  selectedPayment: PaymentMethod;
  appointmentDate: string;
  address: string;
  clientBookingStep: ClientBookingStep;
  parcelDeliveryType: string;
  parcelNote: string;
  parcelPickupAddress: string;
  parcelDropoffAddress: string;
  parcelPickupContact: ParcelContactDraft;
  parcelDropoffContact: ParcelContactDraft;
  parcels: ParcelDraft[];
  offerAmount: number;
  customOfferTouched: boolean;
  selectedOfferStep: number;
}

@Component({
  selector: 'app-service-proposal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    ServiceProposalAcceptedSummaryComponent,
    ServiceProposalDetailsModalComponent,
  ],
  templateUrl: './service-proposal.component.html',
  styleUrls: [
    './service-proposal.component.scss',
    './service-proposal-parcel.component.scss',
    './service-proposal-provider-mode.component.scss',
    './service-proposal-negotiation-state.component.scss',
    './service-proposal-responsive.component.scss',
  ],
})
export class ServiceProposalComponent implements OnDestroy, OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicesService = inject(ServicesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly availabilityRealtime = inject(AvailabilityRealtimeService);
  private readonly authService = inject(AuthService);
  private readonly messagesService = inject(MessagesService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly authSession = inject(AuthSessionService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly googleMaps = inject(GoogleMapsLoaderService);
  private readonly formatter = inject(ServiceProposalFormatService);
  private readonly materialQuoteMapper = inject(ServiceProposalMaterialQuoteService);
  private readonly parcelService = inject(ServiceProposalParcelService);
  private readonly reservationBuilder = inject(ServiceProposalReservationBuilderService);
  private readonly proposalState = inject(ServiceProposalStateService);
  private readonly proposalUi = inject(ServiceProposalUiService);
  private readonly pricingView = inject(ServiceProposalPricingViewService);

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
  protected readonly linkedReservationStatus = signal<ProposalReservationStatus | null>(null);
  protected readonly linkedReservationCancellationReason = signal<string | null>(null);
  protected readonly isCancellingProposal = signal(false);
  protected readonly isRespondingToCounterOffer = signal(false);
  protected readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  protected readonly isLoadingAddressSuggestions = signal(false);
  protected readonly isAddressSuggestionsOpen = signal(false);
  protected readonly isLocatingAddress = signal(false);
  protected readonly activeDetailsModal = signal<ProposalDetailsModal | null>(null);
  protected readonly clientBookingStep = signal<ClientBookingStep>('DETAILS');
  protected readonly clientDetailsErrors = signal<Partial<Record<ClientDetailsField, string>>>({});
  protected readonly clientBookingDetailsExpanded = signal(false);
  protected readonly materialQuoteExpanded = signal(false);
  protected readonly isMaterialQuoteFormOpen = signal(false);
  protected readonly materialQuoteEntries = signal<MaterialQuoteEntry[]>([]);
  protected readonly isMaterialQuotesLoading = signal(false);
  private readonly materialQuotesLoadedFor = signal<string | null>(null);
  private readonly usedParcelNumbers = new Set<string>();
  private proposalRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private parcelPriceRequestId = 0;

  protected readonly profileId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly negotiationId = this.route.snapshot.queryParamMap.get('negotiationId') || '';
  protected readonly isProviderProposalMode =
    this.route.snapshot.queryParamMap.get('mode') === 'prestataire';
  protected readonly selectedServiceId = signal(
    this.route.snapshot.queryParamMap.get('serviceId') || '',
  );
  protected readonly customServiceName = signal('');
  protected readonly selectedPayment = signal<PaymentMethod>('WAVE');

  protected readonly appointmentDate = signal('');
  protected readonly address = signal('');
  protected readonly parcelDeliveryType = signal('');
  protected readonly parcelNote = signal('');
  protected readonly parcelPickupAddress = signal('');
  protected readonly parcelDropoffAddress = signal('');
  protected readonly parcelPickupContact = signal<ParcelContactDraft>({ name: '', phone: '' });
  protected readonly parcelDropoffContact = signal<ParcelContactDraft>({ name: '', phone: '' });
  protected readonly parcelDescriptionExpanded = signal(true);
  protected readonly parcels = signal<ParcelDraft[]>([]);
  private readonly appointmentAddressCoordinate = signal<GoogleMapsCoordinate | null>(null);
  private readonly parcelPickupCoordinate = signal<GoogleMapsCoordinate | null>(null);
  private readonly parcelDropoffCoordinate = signal<GoogleMapsCoordinate | null>(null);
  protected readonly parcelDistanceMeters = signal<number | null>(null);
  protected readonly isParcelPriceLoading = signal(false);
  protected readonly parcelPriceError = signal<string | null>(null);
  private readonly clientDefaultAddress = signal('');
  protected readonly offerAmount = signal(0);
  protected readonly customOfferTouched = signal(false);
  protected readonly offerSteps = [100, 250, 500];
  protected readonly selectedOfferStep = signal(250);
  private readonly draftPersistenceReady = signal(false);
  private readonly clientDraftAutosave = effect(() => {
    if (!this.draftPersistenceReady()) {
      return;
    }

    this.persistClientReservationDraft({
      selectedServiceId: this.selectedServiceId(),
      customServiceName: this.customServiceName(),
      selectedPayment: this.selectedPayment(),
      appointmentDate: this.appointmentDate(),
      address: this.address(),
      clientBookingStep: this.clientBookingStep(),
      parcelDeliveryType: this.parcelDeliveryType(),
      parcelNote: this.parcelNote(),
      parcelPickupAddress: this.parcelPickupAddress(),
      parcelDropoffAddress: this.parcelDropoffAddress(),
      parcelPickupContact: this.parcelPickupContact(),
      parcelDropoffContact: this.parcelDropoffContact(),
      parcels: this.parcels(),
      offerAmount: this.offerAmount(),
      customOfferTouched: this.customOfferTouched(),
      selectedOfferStep: this.selectedOfferStep(),
    });
  });
  protected readonly materialQuoteDraft: MaterialQuoteDraft = {
    designation: '',
    unitPrice: null,
    quantity: 1,
    author: 'CLIENT',
  };

  protected readonly paymentOptions = this.proposalUi.paymentOptions;

  protected readonly currentService = computed<BackendProfessionalDetailService | null>(() => {
    const services = this.detail()?.services ?? [];
    const selectedId = this.selectedServiceId();
    return selectedId ? services.find((service) => service.id === selectedId) ?? null : null;
  });
  protected readonly customNegotiationService = computed<BackendProfessionalDetailService | null>(() =>
    this.resolveCustomNegotiationService(this.currentService()),
  );
  protected readonly providerTravelsToClient = computed(
    () => this.currentService()?.modeDeplacement !== 'CLIENT_SE_DEPLACE',
  );
  protected readonly isParcelDeliveryService = computed(
    () => this.currentService()?.modeDeplacement === 'TRANSPORT_COLIS',
  );
  protected readonly parcelPricePerKm = computed(() => {
    if (!this.isParcelDeliveryService()) return 0;
    const price = Math.trunc(Number(this.currentService()?.prix ?? 0));
    return Number.isFinite(price) && price > 0 ? price : 0;
  });
  protected readonly parcelComputedPrice = computed(() => {
    const distanceMeters = this.parcelDistanceMeters();
    const pricePerKm = this.parcelPricePerKm();
    if (!distanceMeters || distanceMeters <= 0 || pricePerKm <= 0) return 0;

    return Math.max(500, Math.round((distanceMeters / 1000) * pricePerKm));
  });
  protected readonly fairServiceAmount = computed(() => {
    if (this.customServiceName()) {
      return 0;
    }

    if (this.isParcelDeliveryService()) {
      return this.parcelComputedPrice();
    }

    return Math.trunc(Number(this.currentService()?.prix ?? 0));
  });
  protected readonly clientTravelsToProvider = computed(() => !this.providerTravelsToClient());
  protected readonly providerInterventionAddress = computed(() =>
    this.resolveInitialAddress(this.detail()),
  );
  protected readonly providerInterventionAddressLabel = computed(
    () => this.providerInterventionAddress() || 'Adresse du prestataire non renseignee',
  );
  protected readonly appointmentAddressLabel = computed(() =>
    this.isParcelDeliveryService()
      ? 'Arrivee destinataire'
      : this.clientTravelsToProvider()
        ? 'Adresse du prestataire'
        : "Adresse d'intervention",
  );

  protected readonly displayName = computed(() => {
    const profile = this.detail()?.profile;
    return profile?.nomEntreprise || profile?.utilisateur.nom || 'Prestataire';
  });

  protected readonly avatarUrl = computed(() => this.detail()?.profile.utilisateur.urlAvatar || '');

  protected readonly providerInitials = computed(() => userInitials(this.displayName(), 'JD'));
  protected readonly providerVehicleBadge = computed(() => {
    if (this.currentService()?.modeDeplacement !== 'TRANSPORT_COLIS') return null;
    const vehicleType = this.detail()?.profile.typeVehicule;
    return vehicleType ? PROFESSIONAL_VEHICLE_BADGES[vehicleType] : null;
  });
  protected readonly proposalClientName = computed(
    () => this.pendingProposal()?.client?.nom || 'Client',
  );
  protected readonly proposalClientInitials = computed(() =>
    userInitials(this.proposalClientName(), 'CL'),
  );
  protected readonly canProviderRespond = computed(
    () => this.pendingProposal()?.statut === 'EN_ATTENTE_PRESTATAIRE',
  );
  protected readonly providerProposalStatusLabel = computed(() =>
    this.pricingView.providerProposalStatusLabel(this.pendingProposal()?.statut),
  );

  protected readonly providerBaseOfferAmount = computed(() =>
    this.pricingView.providerBaseOfferAmount({
      proposal: this.pendingProposal(),
      currentService: this.currentService(),
      fairServiceAmount: this.fairServiceAmount(),
    }),
  );
  protected readonly providerBaseOfferLabel = computed(() =>
    this.formatAmount(this.providerBaseOfferAmount()),
  );
  protected readonly providerCurrentClientOfferLabel = computed(() =>
    this.formatAmount(this.pendingProposal()?.montantCourant ?? this.offerAmount()),
  );
  protected readonly providerCounterDifferenceLabel = computed(() =>
    this.pricingView.providerCounterDifferenceLabel(
      this.providerBaseOfferAmount(),
      this.offerAmount(),
    ),
  );
  protected readonly providerCounterActionLabel = computed(() =>
    this.pricingView.providerCounterActionLabel(this.pendingProposal(), this.offerAmount()),
  );
  protected readonly providerSummaryPriceLabel = computed(() =>
    this.pricingView.providerSummaryPriceLabel(this.pendingProposal()),
  );
  protected readonly providerSummaryAmountLabel = computed(() =>
    this.formatAmount(this.providerBaseOfferAmount()),
  );
  protected readonly parcelDistanceLabel = computed(() => {
    const meters = this.parcelDistanceMeters();
    if (!meters || meters <= 0) return '';
    return `${this.formatDecimal(meters / 1000, 1)} km`;
  });
  protected readonly parcelPricePerKmLabel = computed(() => {
    const price = this.parcelPricePerKm();
    return price > 0 ? `${this.formatAmount(price)} FCFA/km` : '';
  });
  protected readonly parcelPriceBasisLabel = computed(() => {
    if (!this.isParcelDeliveryService()) return '';
    if (this.isParcelPriceLoading()) return 'Calcul du prix selon la distance...';
    if (this.parcelDistanceLabel() && this.parcelPricePerKmLabel()) {
      return `${this.parcelDistanceLabel()} x ${this.parcelPricePerKmLabel()}`;
    }
    return this.parcelPriceError() || 'Renseignez depart et arrivee pour calculer le prix.';
  });
  protected readonly materialQuoteTotalLabel = computed(() => {
    const total = this.materialQuoteEntries().filter((item) => item.status !== 'REFUSE').reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    return `${this.formatAmount(total)} FCFA`;
  });
  protected readonly materialQuoteAuthorLabel = computed(() => `${this.displayName().toUpperCase()} PROPOSE :`);
  protected readonly canShowMaterialQuotePanel = computed(() => !this.isParcelDeliveryService());
  protected readonly canCurrentUserCreateMaterialQuote = computed(
    () => this.isProviderProposalMode && this.canShowMaterialQuotePanel(),
  );
  protected readonly hasBlockingMaterialQuote = computed(() => {
    if (!this.canShowMaterialQuotePanel()) return false;
    const entries = this.materialQuoteEntries();
    return entries.some((entry) => entry.status === 'EN_ATTENTE');
  });
  protected readonly durationMinutes = computed(() => this.serviceDurationMinutes(this.currentService()));
  protected readonly pauseMinutes = computed(() => this.servicePauseMinutes(this.currentService()));
  protected readonly isMaterialQuoteStateReady = computed(() => {
    if (!this.canShowMaterialQuotePanel()) return true;
    const proposalId = this.pendingProposal()?.id;
    return !proposalId || this.materialQuotesLoadedFor() === proposalId;
  });
  protected readonly canCurrentUserRespondToMaterialQuote = computed(() => !this.isProviderProposalMode);
  protected readonly providerProposalFinalized = computed(() => {
    const proposal = this.pendingProposal();
    if (!proposal) return null;
    if (this.isLinkedReservationCancelled()) return null;
    return proposal.reservationId || proposal.statut === 'CONVERTIE_EN_RESERVATION'
      ? proposal
      : null;
  });
  protected readonly closedProposal = computed(() => {
    const proposal = this.pendingProposal();
    return proposal && (this.isNegotiationClosed(proposal) || this.isLinkedReservationCancelled())
      ? proposal
      : null;
  });
  protected readonly providerFinalizedAmountLabel = computed(() =>
    this.formatAmount(
      this.providerProposalFinalized()?.montantAccepte ??
        this.providerProposalFinalized()?.montantCourant ??
        this.offerAmount(),
    ),
  );
  protected readonly providerFinalizedComparisonLabel = computed(() =>
    this.pricingView.providerFinalizedComparisonLabel(
      this.toPositiveAmount(this.providerBaseOfferAmount()),
      this.toPositiveAmount(
        this.providerProposalFinalized()?.montantAccepte ??
          this.providerProposalFinalized()?.montantCourant,
      ),
    ),
  );
  protected readonly providerFinalizedComparisonAmountLabel = computed(() =>
    this.pricingView.providerFinalizedComparisonAmountLabel(
      this.toPositiveAmount(this.providerBaseOfferAmount()),
      this.toPositiveAmount(
        this.providerProposalFinalized()?.montantAccepte ??
          this.providerProposalFinalized()?.montantCourant,
      ),
    ),
  );

  protected readonly categoryLabel = computed(
    () => this.customServiceName() || this.currentService()?.nom || 'Selectionnez un motif...',
  );
  protected readonly isFixedPriceService = computed(
    () => !this.customServiceName() && this.currentService()?.typePrix === 'FIXE',
  );
  protected readonly pageTitle = computed(() =>
    this.isFixedPriceService()
      ? 'Confirmez votre rendez-vous'
      : 'Proposez un prix et choisissez votre rendez-vous',
  );
  protected readonly providerOnlineLabel = computed(() => this.proposalUi.providerOnlineLabel(this.detail()));
  protected readonly priceSectionTitle = computed(() => this.proposalUi.priceSectionTitle(this.isFixedPriceService()));
  protected readonly offerFieldLabel = computed(() => this.proposalUi.offerFieldLabel(this.isFixedPriceService()));
  protected readonly summaryPriceLabel = computed(() => this.proposalUi.summaryPriceLabel(this.isFixedPriceService()));
  protected readonly checkoutTotalLabel = computed(() => this.proposalUi.checkoutTotalLabel(this.isFixedPriceService()));
  protected readonly canGoToClientPriceStep = computed(
    () => Object.keys(this.collectClientDetailsErrors(false)).length === 0,
  );
  protected readonly submitButtonLabel = computed(() => {
    return this.proposalUi.submitButtonLabel({
      isSubmitting: this.isSubmitting(),
      hasCustomServiceName: Boolean(this.customServiceName()),
      isFixedPriceService: this.isFixedPriceService(),
      isOfferAdjusted: this.isOfferAdjusted(),
    });
  });
  protected readonly submitButtonVisualLabel = computed(() =>
    this.proposalUi.submitButtonVisualLabel({
      isSubmitting: this.isSubmitting(),
      submitButtonLabel: this.submitButtonLabel(),
      hasCustomServiceName: Boolean(this.customServiceName()),
      isOfferAdjusted: this.isOfferAdjusted(),
    }),
  );

  protected readonly ratingLabel = computed(() => {
    return this.proposalUi.ratingLabel(this.detail());
  });

  protected readonly formattedDate = computed(() => {
    return this.proposalUi.formattedDate(this.appointmentDate());
  });

  protected readonly formattedTime = computed(() => {
    return this.proposalUi.formattedTime(this.appointmentDate());
  });

  protected readonly initialPriceLabel = computed(() => {
    const price = this.fairServiceAmount();
    return price > 0 ? `${this.formatAmount(price)} FCFA` : 'A definir';
  });

  protected readonly offerDifferenceLabel = computed(() =>
    this.pricingView.offerDifferenceLabel({
      servicePrice: this.fairServiceAmount(),
      offerAmount: this.offerAmount(),
      hasCustomServiceName: Boolean(this.customServiceName()),
    }),
  );
  protected readonly isOfferAdjusted = computed(() => {
    if (this.isFixedPriceService()) {
      return false;
    }

    if (this.customServiceName()) {
      return Math.trunc(Number(this.offerAmount())) > 0;
    }

    const servicePrice = Math.trunc(Number(this.fairServiceAmount()));
    const offer = Math.trunc(Number(this.offerAmount()));
    return servicePrice > 0 && offer > 0 && servicePrice !== offer;
  });
  protected readonly offerDifferenceIcon = computed(() =>
    this.pricingView.offerDifferenceIcon(this.fairServiceAmount(), this.offerAmount()),
  );
  protected readonly offerEquityLabel = computed(() =>
    this.pricingView.offerEquityLabel({
      hasCustomServiceName: Boolean(this.customServiceName()),
      isFixedPriceService: this.isFixedPriceService(),
    }),
  );

  protected readonly shortAddress = computed(() =>
    this.truncate(
      this.isParcelDeliveryService()
        ? this.parcelDropoffAddress()
        : this.clientTravelsToProvider()
        ? this.providerInterventionAddressLabel()
        : this.address(),
      28,
    ),
  );
  protected readonly hasCustomOfferAmount = computed(() =>
    !this.customServiceName() ||
    (this.customOfferTouched() && Math.trunc(Number(this.offerAmount())) >= 500),
  );
  protected readonly formattedOffer = computed(() =>
    this.customServiceName() && !this.customOfferTouched()
      ? ''
      : this.formatAmount(this.offerAmount()),
  );
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
  protected readonly counterDifferenceLabel = computed(() =>
    this.pricingView.counterDifferenceLabel(this.pendingProposal()),
  );
  protected readonly counterActionLabel = computed(() =>
    this.pricingView.counterActionLabel(this.pendingProposal(), this.offerAmount()),
  );
  protected readonly acceptedAmountLabel = computed(() =>
    this.formatAmount(this.acceptedReservation()?.proposal.montantCourant ?? this.offerAmount()),
  );
  protected readonly acceptedTotalLabel = computed(
    () =>
      `${this.formatAmount(this.acceptedReservation()?.proposal.montantCourant ?? this.offerAmount())} FCFA`,
  );
  protected readonly acceptedDateTimeLabel = computed(() => {
    const accepted = this.acceptedReservation();
    return accepted
      ? this.formatAcceptedDateTime(accepted.dateHeure)
      : `${this.formattedDate()} a ${this.formattedTime()}`;
  });
  protected readonly acceptedDateLabel = computed(() => {
    const accepted = this.acceptedReservation();
    return accepted ? this.formatAcceptedDate(accepted.dateHeure) : this.formattedDate();
  });
  protected readonly acceptedTimeLabel = computed(() => {
    const accepted = this.acceptedReservation();
    return accepted ? this.formatAcceptedTime(accepted.dateHeure) : this.formattedTime();
  });
  protected readonly acceptedAddressLabel = computed(
    () =>
      this.acceptedReservation()?.adresseClient || this.address().trim() || 'Adresse a confirmer',
  );
  protected readonly acceptedComparisonLabel = computed(() =>
    this.pricingView.acceptedComparisonLabel(
      this.toPositiveAmount(this.fairServiceAmount()),
      this.toPositiveAmount(this.acceptedReservation()?.proposal.montantCourant),
    ),
  );
  protected readonly acceptedComparisonAmountLabel = computed(() =>
    this.pricingView.acceptedComparisonAmountLabel(
      this.toPositiveAmount(this.fairServiceAmount()),
      this.toPositiveAmount(this.acceptedReservation()?.proposal.montantCourant),
    ),
  );
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
  private availabilityRealtimeSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.loadDetail();
  }

  ngOnDestroy(): void {
    if (this.availabilityCheckTimeoutId) {
      clearTimeout(this.availabilityCheckTimeoutId);
    }

    this.stopAvailabilityRealtime();
    this.stopProposalRefresh();
  }

  protected goBack(): void {
    if (!this.isProviderProposalMode && this.clientBookingStep() === 'PRICE') {
      this.goToClientDetailsStep();
      return;
    }

    const fallback = this.isProviderProposalMode
      ? '/prestataire/espace'
      : `/services/${this.profileId || this.detail()?.profile.id || ''}`;
    this.backNavigation.back(this.safeReturnUrl(), fallback);
  }

  protected trackByParcelId(_index: number, parcel: ParcelDraft): string {
    return parcel.id;
  }

  protected selectPayment(method: PaymentMethod): void {
    this.selectedPayment.set(method);
  }

  protected updateOfferAmount(value: number | string): void {
    const amount = Number(String(value).replace(/[^\d]/g, ''));
    if (this.customServiceName()) {
      this.customOfferTouched.set(String(value).trim().length > 0);
    }
    this.offerAmount.set(Number.isFinite(amount) ? amount : 0);
    if (this.isProviderProposalMode && this.canProviderRespond()) {
      this.isProviderOfferDirty.set(true);
    }
  }

  protected openDetailsModal(modal: ProposalDetailsModal): void {
    if (modal === 'address' && this.clientTravelsToProvider()) {
      this.syncAddressForCurrentTravelMode();
      this.feedback.info('Cette adresse est celle renseignee par le prestataire dans ses parametres.');
      return;
    }

    this.activeDetailsModal.set(modal);
  }

  protected activeModalAddress(): string {
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') return this.parcelPickupAddress();
    if (modal === 'parcelDropoff') return this.parcelDropoffAddress();
    return this.address();
  }

  protected activeModalContactName(): string {
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') return this.parcelPickupContact().name;
    if (modal === 'parcelDropoff') return this.parcelDropoffContact().name;
    return '';
  }

  protected activeModalContactPhone(): string {
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') return this.parcelPickupContact().phone;
    if (modal === 'parcelDropoff') return this.parcelDropoffContact().phone;
    return '';
  }

  protected closeDetailsModal(): void {
    this.activeDetailsModal.set(null);
    this.isAddressSuggestionsOpen.set(false);
  }

  protected goToClientDetailsStep(): void {
    this.clientBookingStep.set('DETAILS');
  }

  protected goToClientPriceStep(): void {
    if (!this.validateClientDetailsStep()) {
      this.feedback.info('Completez tous les champs de la partie 1 avant de continuer.');
      return;
    }

    this.clientBookingStep.set('PRICE');
  }

  protected toggleClientBookingDetails(): void {
    this.clientBookingDetailsExpanded.update((expanded) => !expanded);
  }

  protected toggleParcelDescription(): void {
    this.parcelDescriptionExpanded.update((expanded) => !expanded);
  }

  protected toggleMaterialQuote(): void {
    this.materialQuoteExpanded.update((expanded) => !expanded);
  }

  protected requestMaterialQuoteItem(): void {
    if (!this.canCurrentUserCreateMaterialQuote()) {
      this.feedback.info('Le devis materiel doit etre renseigne par le prestataire.');
      return;
    }
    this.materialQuoteExpanded.set(true);
    this.materialQuoteDraft.author = this.isProviderProposalMode ? 'PRESTATAIRE' : 'CLIENT';
    this.isMaterialQuoteFormOpen.set(true);
  }

  protected closeMaterialQuoteForm(): void {
    this.resetMaterialQuoteDraft();
    this.isMaterialQuoteFormOpen.set(false);
  }

  protected selectMaterialQuoteAuthor(author: MaterialQuoteAuthor): void {
    this.materialQuoteDraft.author = author;
  }

  protected decreaseMaterialQuoteQuantity(): void {
    this.materialQuoteDraft.quantity = Math.max(1, this.materialQuoteDraft.quantity - 1);
  }

  protected increaseMaterialQuoteQuantity(): void {
    this.materialQuoteDraft.quantity += 1;
  }

  protected validateMaterialQuoteDraft(): void {
    if (!this.canCurrentUserCreateMaterialQuote()) {
      this.feedback.info('Le devis materiel doit etre renseigne par le prestataire.');
      return;
    }
    const designation = this.materialQuoteDraft.designation.trim();
    const unitPrice = Math.trunc(Number(this.materialQuoteDraft.unitPrice ?? 0));
    const quantity = Math.max(1, Math.trunc(Number(this.materialQuoteDraft.quantity)));

    if (!designation) {
      this.feedback.info('Renseignez le nom du materiel.');
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      this.feedback.info('Renseignez le prix unitaire du materiel.');
      return;
    }

    const proposal = this.pendingProposal();
    if (!proposal?.id) {
      this.materialQuoteEntries.update((items) => [
        ...items,
        this.materialQuoteMapper.toLocalEntry({
          designation,
          unitPrice,
          quantity,
          userId: this.userId(),
          author: this.isProviderProposalMode ? 'PRESTATAIRE' : 'CLIENT',
        }),
      ]);
      this.resetMaterialQuoteDraft();
      this.isMaterialQuoteFormOpen.set(false);
      return;
    }

    this.proposalService
      .createMaterialQuote(proposal.id, { designation, unitPrice, quantity })
      .subscribe({
        next: (quote) => {
          this.materialQuoteEntries.update((items) => [
            ...items,
            this.materialQuoteMapper.toEntry(quote),
          ]);
          this.resetMaterialQuoteDraft();
          this.isMaterialQuoteFormOpen.set(false);
          this.feedback.success('Materiel ajoute au devis.');
        },
        error: (error) => this.handleProposalError(error),
      });
  }

  protected validateMaterialQuoteEntry(entryId: string): void {
    const proposal = this.pendingProposal();
    if (!proposal?.id || entryId.startsWith('local-')) {
      this.materialQuoteEntries.update((items) =>
        items.map((item) =>
          item.id === entryId ? { ...item, status: 'VALIDE', clientValidatedAt: new Date().toISOString() } : item,
        ),
      );
      return;
    }

    this.proposalService.approveMaterialQuote(proposal.id, entryId).subscribe({
      next: (quote) => this.replaceMaterialQuoteEntry(quote),
      error: (error) => this.handleProposalError(error),
    });
  }

  protected removeMaterialQuoteEntry(entryId: string): void {
    const proposal = this.pendingProposal();
    if (!proposal?.id || entryId.startsWith('local-')) {
      this.materialQuoteEntries.update((items) => items.filter((item) => item.id !== entryId));
      return;
    }

    this.proposalService.rejectMaterialQuote(proposal.id, entryId).subscribe({
      next: (quote) => this.replaceMaterialQuoteEntry(quote),
      error: (error) => this.handleProposalError(error),
    });
  }

  protected canShowMaterialQuoteDecision(entry: MaterialQuoteEntry): boolean {
    return this.canCurrentUserRespondToMaterialQuote() && entry.status === 'EN_ATTENTE';
  }

  protected materialQuoteEntryAuthorLabel(entry: MaterialQuoteEntry): string {
    return this.materialQuoteMapper.authorLabel(entry);
  }

  protected materialQuoteDraftAuthorLabel(): string {
    return this.materialQuoteMapper.draftAuthorLabel(this.isProviderProposalMode);
  }

  protected materialQuoteEntryTotalLabel(entry: MaterialQuoteEntry): string {
    return `${this.formatAmount(entry.unitPrice * entry.quantity)} FCFA`;
  }

  protected materialQuoteEntryUnitLabel(entry: MaterialQuoteEntry): string {
    return `${this.formatAmount(entry.unitPrice)} FCFA/u`;
  }

  protected materialQuoteEntryIsValidatedByCurrentUser(entry: MaterialQuoteEntry): boolean {
    return this.materialQuoteMapper.isValidatedByViewer(entry, this.isProviderProposalMode);
  }

  protected materialQuoteEntryStatusLabel(entry: MaterialQuoteEntry): string {
    return this.materialQuoteMapper.statusLabel(entry, this.isProviderProposalMode);
  }

  private resetMaterialQuoteDraft(): void {
    this.materialQuoteDraft.designation = '';
    this.materialQuoteDraft.unitPrice = null;
    this.materialQuoteDraft.quantity = 1;
    this.materialQuoteDraft.author = this.isProviderProposalMode ? 'PRESTATAIRE' : 'CLIENT';
  }

  private replaceMaterialQuoteEntry(quote: MaterialQuoteView): void {
    const entry = this.materialQuoteMapper.toEntry(quote);
    this.materialQuoteEntries.update((items) =>
      items.map((item) => (item.id === entry.id ? entry : item)),
    );
  }

  private loadMaterialQuotes(negotiationId: string): void {
    const isFirstLoadForNegotiation = this.materialQuotesLoadedFor() !== negotiationId;
    if (isFirstLoadForNegotiation) {
      this.isMaterialQuotesLoading.set(true);
      this.materialQuoteEntries.set([]);
    }

    this.proposalService.listMaterialQuotes(negotiationId).subscribe({
      next: (quotes) => {
        this.materialQuoteEntries.set(
          quotes.map((quote) => this.materialQuoteMapper.toEntry(quote)),
        );
        this.materialQuotesLoadedFor.set(negotiationId);
        this.isMaterialQuotesLoading.set(false);
      },
      error: () => {
        this.isMaterialQuotesLoading.set(false);
        this.materialQuotesLoadedFor.set(null);
      },
    });
  }

  private syncLocalMaterialQuotes(negotiationId: string, done: () => void): void {
    const localQuotes = this.materialQuoteEntries().filter((item) => item.id.startsWith('local-'));
    if (localQuotes.length === 0) {
      done();
      return;
    }

    forkJoin(
      localQuotes.map((item) =>
        this.proposalService.createMaterialQuote(negotiationId, {
          designation: item.designation,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        }),
      ),
    ).subscribe({
      next: (quotes) => {
        this.materialQuoteEntries.set(
          quotes.map((quote) => this.materialQuoteMapper.toEntry(quote)),
        );
        done();
      },
      error: (error) => {
        this.handleProposalError(error);
        done();
      },
    });
  }

  private finalizeMaterialQuotesForReservation(
    proposal: NegotiationView,
    reservationId: string,
  ): void {
    this.proposalService.finalizeMaterialQuotes(proposal.id, reservationId).subscribe({
      next: () => undefined,
      error: (error) => this.handleProposalError(error),
    });
  }

  private userId(): string {
    return this.authSession.currentUser()?.id ?? '';
  }

  protected selectService(serviceId: string): void {
    const service = this.detail()?.services.find((item) => item.id === serviceId);
    if (!service) return;

    this.customServiceName.set('');
    this.customOfferTouched.set(false);
    this.selectedServiceId.set(service.id);
    if (service.modeDeplacement === 'TRANSPORT_COLIS') {
      this.offerAmount.set(this.parcelComputedPrice());
      this.refreshParcelDeliveryPriceEstimate();
    } else {
      this.resetParcelDeliveryPricing();
      this.offerAmount.set(service.prix ?? 0);
    }
    this.syncAddressForCurrentTravelMode();
    this.availabilityStatus.set(null);
    this.availabilitySlots.set([]);
    this.clearClientDetailsErrors('service', 'schedule', 'availability');
    this.scheduleAvailabilityCheck();
  }

  protected selectCustomService(name: string): void {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (normalizedName.length < 3 || normalizedName.length > 200) {
      this.feedback.info('Le motif doit contenir entre 3 et 200 caracteres.');
      return;
    }

    this.customServiceName.set(normalizedName);
    const supportService = this.resolveCustomNegotiationService(this.currentService());
    if (!supportService) {
      this.customServiceName.set('');
      this.feedback.info(
        'Ce prestataire doit avoir au moins un service negociable disponible pour recevoir une offre personnalisee.',
      );
      return;
    }

    this.selectedServiceId.set(supportService.id);
    this.offerAmount.set(0);
    this.customOfferTouched.set(false);
    this.syncAddressForCurrentTravelMode();
    this.availabilityStatus.set(null);
    this.availabilitySlots.set([]);
    this.clearClientDetailsErrors('service', 'schedule', 'availability');
    this.scheduleAvailabilityCheck();
    this.feedback.success('Le nouveau motif a ete ajoute a votre proposition.');
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
      this.feedback.info(
        'La contre-proposition doit être différente du montant proposé par le client.',
      );
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
    this.proposalService
      .rejectPriceProposal(proposal.id, 'Proposition refusée par le prestataire.')
      .subscribe({
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

  protected updateOfferStep(value: number | string): void {
    const step = Math.trunc(Number(value));
    if (!Number.isFinite(step)) {
      return;
    }

    this.selectedOfferStep.set(Math.min(1000, Math.max(100, step)));
  }

  protected decreaseOffer(): void {
    if (this.isFixedPriceService()) {
      return;
    }

    const nextAmount = Math.max(500, Math.trunc(this.offerAmount() - this.selectedOfferStep()));
    this.offerAmount.set(nextAmount);
    if (this.customServiceName()) {
      this.customOfferTouched.set(true);
    }
    if (this.isProviderProposalMode && this.canProviderRespond()) {
      this.isProviderOfferDirty.set(true);
    }
  }

  protected increaseOffer(): void {
    if (this.isFixedPriceService()) {
      return;
    }

    const nextAmount = Math.min(
      10_000_000,
      this.customServiceName() && Math.trunc(this.offerAmount()) <= 0
        ? 500
        : Math.max(0, Math.trunc(this.offerAmount())) + this.selectedOfferStep(),
    );
    this.offerAmount.set(nextAmount);
    if (this.customServiceName()) {
      this.customOfferTouched.set(true);
    }
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
    const proposal = this.pendingProposal();
    const professionalId = service?.profilProfessionnelId ?? proposal?.professionnelId;
    if (!professionalId) {
      this.feedback.error('Impossible d ouvrir la discussion avec ce prestataire.');
      return;
    }

    this.router.navigate(['/messages'], {
      queryParams: this.buildMessageQuery({
        professionalId,
        providerName: this.displayName(),
        serviceName: service?.nom || this.categoryLabel(),
        proposal,
      }),
    });
  }

  protected messageClient(): void {
    if (!this.authSession.getAccessToken()) {
      this.feedback.info('Connectez-vous d abord pour ecrire au client.');
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    const proposal = this.pendingProposal();
    if (!proposal) {
      this.feedback.error('Impossible d ouvrir la discussion avec ce client.');
      return;
    }

    this.router.navigate(['/messages'], {
      queryParams: this.buildMessageQuery({
        professionalId: proposal.professionnelId,
        providerName: this.proposalClientName(),
        serviceName: proposal.service?.nom || this.categoryLabel(),
        proposal,
      }),
    });
  }

  private buildMessageQuery(input: {
    professionalId: string;
    providerName: string;
    serviceName: string;
    proposal: NegotiationView | null;
  }): Record<string, string | number> {
    const proposal = input.proposal;
    const query: Record<string, string | number> = {
      professionalId: input.professionalId,
      providerName: input.providerName,
      serviceName: input.serviceName,
      amount: Math.trunc(Number(proposal?.montantCourant ?? this.offerAmount() ?? 0)),
    };

    if (proposal?.id) {
      query['negotiationId'] = proposal.id;
    }

    if (proposal?.reservationId) {
      query['reservationId'] = proposal.reservationId;
    }

    if (proposal?.statut) {
      query['status'] = proposal.statut;
    }

    if (proposal?.dateHeureProposee) {
      query['appointmentDate'] = proposal.dateHeureProposee;
    }

    if (proposal?.adresseClientProposee) {
      query['address'] = proposal.adresseClientProposee;
    }

    if (proposal?.dureeMinutesProposee) {
      query['durationMinutes'] = proposal.dureeMinutesProposee;
    }

    return query;
  }

  protected cancelPendingProposal(): void {
    const proposal = this.pendingProposal();
    if (!proposal || this.isCancellingProposal()) {
      return;
    }

    this.isCancellingProposal.set(true);
    this.proposalService
      .cancelPriceProposal(proposal.id, 'Annulation demandee par le client.')
      .subscribe({
        next: () => {
          this.feedback.success('Votre offre a ete annulee.');
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

    if (!this.isMaterialQuoteStateReady()) {
      this.feedback.info('Synchronisation du devis materiel en cours. Reessayez dans un instant.');
      return;
    }

    if (this.hasBlockingMaterialQuote()) {
      this.feedback.info('Validez ou refusez le devis materiel avant de finaliser la reservation.');
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
    this.clearClientDetailsErrors('schedule', 'availability');
    this.scheduleAvailabilityCheck();
  }

  protected updateParcelDeliveryType(value: string): void {
    this.parcelDeliveryType.set(value);
  }

  protected updateParcelDescription(parcelId: string, value: string): void {
    this.parcels.update((parcels) =>
      parcels.map((parcel) =>
        parcel.id === parcelId ? { ...parcel, description: value } : parcel,
      ),
    );
    this.clearClientDetailsErrors('parcels');
  }

  protected addParcel(): void {
    const nextIndex = this.parcels().length + 1;
    this.parcels.update((parcels) => [
      ...parcels,
      this.parcelService.createParcelDraft(nextIndex, this.usedParcelNumbers),
    ]);
    this.clearClientDetailsErrors('parcels');
  }

  protected removeParcel(parcelId: string): void {
    this.parcels.update((parcels) => parcels.filter((parcel) => parcel.id !== parcelId));
    this.clearClientDetailsErrors('parcels');
  }

  protected updateParcelNote(value: string): void {
    this.parcelNote.set(value);
  }

  protected updateParcelPickupAddress(
    value: string,
    coordinate: GoogleMapsCoordinate | null = null,
  ): void {
    this.parcelPickupAddress.set(value);
    this.parcelPickupCoordinate.set(coordinate);
    this.refreshParcelDeliveryPriceEstimate();
    this.clearClientDetailsErrors('pickupAddress');
  }

  protected updateParcelDropoffAddress(
    value: string,
    coordinate: GoogleMapsCoordinate | null = null,
  ): void {
    this.parcelDropoffAddress.set(value);
    this.address.set(value);
    this.parcelDropoffCoordinate.set(coordinate);
    this.refreshParcelDeliveryPriceEstimate();
    this.clearClientDetailsErrors('dropoffAddress', 'address');
  }

  protected updateActiveParcelAddress(value: string): void {
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') {
      this.updateParcelPickupAddress(value);
      return;
    }

    if (modal === 'parcelDropoff') {
      this.updateParcelDropoffAddress(value);
      return;
    }

    this.updateAddress(value);
  }

  protected updateActiveParcelAddressFromMap(selection: {
    address: string;
    coordinate: GoogleMapsCoordinate;
  }): void {
    this.updateActiveParcelAddressWithCoordinate(selection.address, selection.coordinate);
  }

  private updateActiveParcelAddressWithCoordinate(
    value: string,
    coordinate: GoogleMapsCoordinate,
  ): void {
    const validCoordinate = this.parcelService.normalizeCoordinate(coordinate);
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') {
      this.updateParcelPickupAddress(value, validCoordinate);
      return;
    }

    if (modal === 'parcelDropoff') {
      this.updateParcelDropoffAddress(value, validCoordinate);
      return;
    }

    this.address.set(value);
    this.appointmentAddressCoordinate.set(validCoordinate);
    this.clearClientDetailsErrors('address');
  }

  protected updateActiveParcelContactName(value: string): void {
    const name = value.replace(/\s+/g, ' ');
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') {
      this.parcelPickupContact.update((contact) => ({ ...contact, name }));
      this.clearClientDetailsErrors('pickupContact');
      return;
    }

    if (modal === 'parcelDropoff') {
      this.parcelDropoffContact.update((contact) => ({ ...contact, name }));
      this.clearClientDetailsErrors('dropoffContact');
    }
  }

  protected updateActiveParcelContactPhone(value: string): void {
    const phone = value.replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ');
    const modal = this.activeDetailsModal();
    if (modal === 'parcelPickup') {
      this.parcelPickupContact.update((contact) => ({ ...contact, phone }));
      this.clearClientDetailsErrors('pickupContact');
      return;
    }

    if (modal === 'parcelDropoff') {
      this.parcelDropoffContact.update((contact) => ({ ...contact, phone }));
      this.clearClientDetailsErrors('dropoffContact');
    }
  }

  protected updateAppointmentDay(value: string): void {
    if (!value) {
      return;
    }

    this.appointmentDate.set(`${value}T`);
    this.clearClientDetailsErrors('schedule', 'availability');
    this.scheduleAvailabilityCheck();
  }

  protected handleAddressFocus(): void {
    const query = this.address().trim();
    if (query.length >= 1 && this.addressSuggestions().length > 0) {
      this.isAddressSuggestionsOpen.set(true);
    }
  }

  protected updateAddress(value: string): void {
    if (this.clientTravelsToProvider()) {
      this.syncAddressForCurrentTravelMode();
      this.feedback.info('Le lieu du rendez-vous est fixe par le prestataire.');
      return;
    }

    this.address.set(value);
    this.appointmentAddressCoordinate.set(null);
    this.clearClientDetailsErrors('address');
  }

  protected selectAddressSuggestion(suggestion: AddressSuggestion): void {
    if (this.activeDetailsModal() === 'parcelPickup' || this.activeDetailsModal() === 'parcelDropoff') {
      const coordinate =
        suggestion.latitude === null || suggestion.longitude === null
          ? null
          : this.parcelService.normalizeCoordinate({
              latitude: Number(suggestion.latitude),
              longitude: Number(suggestion.longitude),
            });
      if (coordinate) {
        this.updateActiveParcelAddressWithCoordinate(suggestion.label, coordinate);
      } else {
        this.updateActiveParcelAddress(suggestion.label);
      }
      this.addressSuggestions.set([]);
      this.isAddressSuggestionsOpen.set(false);
      return;
    }

    if (this.clientTravelsToProvider()) {
      this.syncAddressForCurrentTravelMode();
      return;
    }

    this.address.set(suggestion.label);
    this.appointmentAddressCoordinate.set(null);
    this.clearClientDetailsErrors('address');
    this.addressSuggestions.set([]);
    this.isAddressSuggestionsOpen.set(false);
  }

  protected closeAddressSuggestionsSoon(): void {
    setTimeout(() => this.isAddressSuggestionsOpen.set(false), 160);
  }

  protected useCurrentLocationForAddress(): void {
    const isParcelAddressModal =
      this.activeDetailsModal() === 'parcelPickup' || this.activeDetailsModal() === 'parcelDropoff';
    if (this.clientTravelsToProvider() && !isParcelAddressModal) {
      this.syncAddressForCurrentTravelMode();
      this.feedback.info('La geolocalisation nest pas necessaire: le rendez-vous se fait chez le prestataire.');
      return;
    }

    if (!navigator.geolocation) {
      this.feedback.info('La geolocalisation nest pas disponible sur cet appareil.');
      return;
    }

    this.isLocatingAddress.set(true);
    this.feedback.info(
      'Autorisez le partage de votre position pour renseigner votre adresse exacte.',
    );

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
      const coordinate = { latitude, longitude };
      const fallbackLabel = 'Position precise selectionnee, Dakar, Senegal';

      this.updateActiveParcelAddressWithCoordinate(fallbackLabel, coordinate);
      this.addressSuggestions.set([]);
      this.isAddressSuggestionsOpen.set(false);
      this.isLocatingAddress.set(false);
      this.feedback.success(
        accuracy
          ? `Position exacte recuperee avec une precision d'environ ${Math.round(accuracy)} m.`
          : 'Position exacte recuperee.',
      );

      this.googleMaps.reverseGeocode(coordinate).subscribe({
        next: (result) => {
          const label = result?.formattedAddress?.trim() || fallbackLabel;
          this.updateActiveParcelAddressWithCoordinate(this.humanMapAddressLabel(label), coordinate);
        },
        error: () => undefined,
      });
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }

        if (position.coords.accuracy <= idealAccuracyMeters) {
          finishWithBestPosition();
        }
      },
      () => {
        this.isLocatingAddress.set(false);
        stopWatching();
        this.feedback.info(
          'Autorisez la localisation precise pour renseigner automatiquement votre adresse.',
        );
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
    this.clearClientDetailsErrors('schedule', 'availability');
    const service = this.currentService();
    this.availabilityStatus.set({
      available: true,
      reason: slot.reason || 'Disponible',
      professionalId: service?.profilProfessionnelId || '',
      dateHeure: slot.dateHeure,
      dureeMinutes: this.durationMinutes(),
      withinAvailability: true,
      hasConflict: false,
    });
  }

  protected isSlotSelected(slot: ReservationAvailabilitySlotView): boolean {
    return slot.dateHeure === this.toIsoDateTime(this.appointmentDate());
  }

  protected submitProposal(): void {
    const service = this.customServiceName()
      ? this.customNegotiationService()
      : this.currentService();

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

    if (!this.customServiceName() && (draft.service.typePrix !== 'NEGOCIABLE' || !this.isOfferAdjusted())) {
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
          this.clearClientReservationDraft();
          if (hasExistingHistory) {
            this.feedback.info('Une discussion est deja ouverte pour ce service.');
          } else {
            this.feedback.success('Votre proposition a ete envoyee au prestataire.');
          }
          this.sendInitialNegotiationMessage(proposal);
          this.syncLocalMaterialQuotes(proposal.id, () => this.showPendingProposal(proposal, draft));
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
          this.clearClientReservationDraft();
          this.feedback.success('Votre nouvelle proposition a ete envoyee.');
          this.syncLocalMaterialQuotes(proposal.id, () => this.showPendingProposal(proposal, draft));
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
        notes: this.reservationBuilder.joinLimitedNotes([
          `Montant affiche: ${this.formatAmount(draft.amount)} FCFA.`,
          `Paiement choisi: ${draft.paymentMethod}.`,
          ...this.reservationLocationNotes(),
        ]),
      })
      .subscribe({
        next: (reservation) => {
          this.feedback.success('Votre rendez-vous a ete cree avec succes.');
          this.clearClientReservationDraft();
          if (reservation.id) {
            this.ensureReservationConversation(reservation.id);
          }
          this.cancelActiveProposalAfterDirectReservation(draft.service.id);
          if (reservation.id) {
            this.router.navigate(['/appointments', reservation.id, 'payment'], {
              queryParams: { returnUrl: '/appointments' },
              replaceUrl: true,
            });
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

  private sendInitialNegotiationMessage(proposal: NegotiationView): void {
    this.messagesService.createConversation({ negotiationId: proposal.id }).subscribe({
      next: (conversation) => {
        const message = proposal.messageCourant || [
          `Demande de negociation pour ${proposal.service?.nom || this.categoryLabel()}.`,
          `Montant propose: ${this.formatAmount(proposal.montantCourant)} FCFA.`,
        ].join(' ');
        this.messagesService.sendMessage(conversation.id, message).subscribe({ error: () => undefined });
      },
      error: () => undefined,
    });
  }

  private ensureReservationConversation(reservationId: string): void {
    this.messagesService.createConversation({ reservationId }).subscribe({
      error: () => undefined,
    });
  }

  private cancelActiveProposalAfterDirectReservation(serviceId: string): void {
    this.proposalService.findActiveProposalForService(serviceId).subscribe({
      next: (proposal) => {
        if (!proposal) return;
        this.proposalService
          .cancelPriceProposal(
            proposal.id,
            'Reservation directe finalisee au prix equitable.',
          )
          .subscribe({ error: () => undefined });
      },
      error: () => undefined,
    });
  }

  private showPendingProposal(proposal: NegotiationView, draft: ReservationDraft): void {
    this.acceptedReservation.set(null);
    this.applyPendingProposalState(proposal, { fallbackAmount: draft.amount });
    this.isSubmitting.set(false);
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
    const adresseClient = this.resolveAppointmentAddress(proposal.adresseClientProposee || '');

    this.isRespondingToCounterOffer.set(true);
    this.proposalService
      .counterPriceProposal(proposal.id, {
        serviceId: service.id,
        proposedAmount: amount,
        message: this.buildProposalMessage({
          service,
          amount,
          dateHeure: this.toIsoDateTime(this.appointmentDate()) ?? proposal.dateHeureProposee ?? '',
          adresseClient,
          dureeMinutes: this.durationMinutes(),
          paymentMethod: this.selectedPayment(),
        }),
        dateHeure:
          this.toIsoDateTime(this.appointmentDate()) ?? proposal.dateHeureProposee ?? undefined,
        adresseClient: adresseClient || undefined,
        dureeMinutes: this.durationMinutes(),
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
    const reservationPayload = this.buildAcceptedNegotiationReservationPayload(proposal);

    if (!reservationPayload) {
      this.isRespondingToCounterOffer.set(false);
      this.feedback.error('Date ou adresse manquante pour creer la reservation.');
      return;
    }

    this.proposalService
      .createReservationFromNegotiation({
        ...reservationPayload,
        notes: this.buildAcceptedReservationNotes(proposal),
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
            dateHeure: reservationPayload.dateHeure,
            adresseClient: reservationPayload.adresseClient,
            dureeMinutes: reservationPayload.dureeMinutes,
          });
          this.linkedReservationStatus.set('CONFIRMEE');
          this.linkedReservationCancellationReason.set(null);
          this.finalizeMaterialQuotesForReservation(proposal, reservationId);
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

    if (this.hasBlockingMaterialQuote()) {
      this.feedback.info('Validez ou refusez le devis materiel avant de finaliser la reservation.');
      return;
    }

    this.router.navigate(['/appointments', accepted.reservationId, 'payment'], {
      queryParams: { returnUrl: '/appointments' },
      replaceUrl: true,
    });
  }

  protected openProviderFinalizedReservation(): void {
    const reservationId = this.providerProposalFinalized()?.reservationId;
    if (!reservationId) {
      this.feedback.info('La reservation est en cours de finalisation.');
      return;
    }

    this.router.navigate(['/appointments', reservationId], {
      queryParams: { returnUrl: '/appointments' },
      replaceUrl: true,
    });
  }

  protected isNegotiationClosed(proposal: NegotiationView | null): boolean {
    return this.proposalState.isNegotiationClosed(proposal);
  }

  protected closedNegotiationTitle(proposal: NegotiationView): string {
    return this.proposalState.closedNegotiationTitle({
      proposal,
      isLinkedReservationCancelled: this.isLinkedReservationCancelled(),
      isProviderProposalMode: this.isProviderProposalMode,
    });
  }

  protected closedNegotiationMessage(proposal: NegotiationView): string {
    return this.proposalState.closedNegotiationMessage({
      proposal,
      serviceName: proposal.service?.nom || this.categoryLabel(),
      isLinkedReservationCancelled: this.isLinkedReservationCancelled(),
      cancellationReason: this.linkedReservationCancellationReason(),
      isProviderProposalMode: this.isProviderProposalMode,
      proposalClientName: this.proposalClientName(),
      providerName: this.displayName(),
    });
  }

  protected exitClosedNegotiation(): void {
    this.pendingProposal.set(null);
    this.stopProposalRefresh();
    this.goBack();
  }

  private startProposalRefresh(negotiationId: string): void {
    this.stopProposalRefresh();
    this.refreshPendingProposal(negotiationId);
    this.proposalRefreshIntervalId = setInterval(() => {
      this.refreshPendingProposal(negotiationId);
    }, 2000);
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
        this.refreshLinkedReservationStatus(proposal);
        this.loadMaterialQuotes(proposal.id);
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

        if (this.shouldStopProposalRefresh(proposal)) {
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

      if (this.isTimeSlotUnavailableError(errorCode)) {
        this.handleTimeSlotUnavailable(error);
        return;
      }
    }

    this.feedback.error(
      getHttpErrorMessage(error, "Impossible d'envoyer cette proposition pour le moment."),
    );
  }

  private isTimeSlotUnavailableError(errorCode: string | undefined): boolean {
    return (
      errorCode === 'RESERVATION_TIME_SLOT_UNAVAILABLE' ||
      errorCode === 'RESERVATIONS_TIME_SLOT_UNAVAILABLE'
    );
  }

  private handleTimeSlotUnavailable(error: HttpErrorResponse): void {
    const service = this.currentService();
    const dateHeure = this.toIsoDateTime(this.appointmentDate());
    const message = getHttpErrorMessage(
      error,
      'Ce creneau vient detre reserve par un autre client. Choisissez un autre horaire.',
    );

    this.isSubmitting.set(false);
    this.isRespondingToCounterOffer.set(false);
    this.feedback.info(message);

    if (service && dateHeure) {
      this.availabilityStatus.set({
        available: false,
        reason: message,
        professionalId: service.profilProfessionnelId,
        dateHeure,
        dureeMinutes: this.durationMinutes(),
        withinAvailability: true,
        hasConflict: true,
      });
      this.clientDetailsErrors.update((errors) => ({
        ...errors,
        availability: message,
      }));

      const selectedDate = this.appointmentDay();
      if (selectedDate) {
        this.loadAvailabilitySlots(service, selectedDate);
      }
    }
  }

  private loadDetail(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      detail: this.servicesService.getProviderProfileDetail(this.profileId),
      proposal: this.negotiationId
        ? this.proposalService.getPriceProposal(this.negotiationId)
        : of(null as NegotiationView | null),
      user: this.authSession.hasAuthenticatedSession()
        ? this.authService.myUserProfile().pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ detail, proposal, user }) => {
        this.detail.set(detail);
        this.startAvailabilityRealtime(detail.profile.id);
        if (proposal) {
          this.draftPersistenceReady.set(false);
          this.applyPendingProposalState(proposal);
          this.isLoading.set(false);
          if (!this.isProviderProposalMode) {
            this.scheduleAvailabilityCheck();
          }
          return;
        } else {
          this.clientDefaultAddress.set(user?.adresse?.trim() || '');
          const restoredDraft = this.restoreClientReservationDraft();
          const service = this.currentService();
          if (!restoredDraft) {
            const providerAddress = this.resolveInitialAddress(detail);
            this.address.set(service?.modeDeplacement === 'CLIENT_SE_DEPLACE' ? providerAddress : '');
          }
          if (service && !restoredDraft) {
            if (service.modeDeplacement === 'TRANSPORT_COLIS') {
              this.offerAmount.set(this.parcelComputedPrice());
              this.refreshParcelDeliveryPriceEstimate();
            } else {
              this.offerAmount.set(service.prix ?? 0);
            }
          } else if (service?.modeDeplacement === 'TRANSPORT_COLIS') {
            this.refreshParcelDeliveryPriceEstimate();
          }
          this.draftPersistenceReady.set(!this.isProviderProposalMode);
          if (!this.isProviderProposalMode && service && this.authSession.hasAuthenticatedSession()) {
            this.resumeActiveClientProposal(service);
            return;
          }
        }
        this.isLoading.set(false);
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

  private clientReservationDraftKey(): string {
    return [
      'jokko',
      'service-proposal-draft',
      this.profileId || 'provider',
      this.negotiationId || 'direct',
    ].join(':');
  }

  private persistClientReservationDraft(draft: ServiceProposalClientDraft): void {
    if (this.isProviderProposalMode || this.pendingProposal()) {
      return;
    }

    try {
      sessionStorage.setItem(this.clientReservationDraftKey(), JSON.stringify(draft));
    } catch {
      // Le brouillon est un confort UI: l'envoi de reservation ne doit jamais dependre du stockage navigateur.
    }
  }

  private restoreClientReservationDraft(): boolean {
    if (this.isProviderProposalMode) {
      return false;
    }

    const raw = this.readClientReservationDraft();
    if (!raw) {
      return false;
    }

    const availableServices = this.detail()?.services ?? [];
    const serviceExists = raw.selectedServiceId
      ? availableServices.some((service) => service.id === raw.selectedServiceId)
      : true;

    if (!serviceExists) {
      this.clearClientReservationDraft();
      return false;
    }

    this.selectedServiceId.set(raw.selectedServiceId || this.selectedServiceId());
    this.customServiceName.set(raw.customServiceName);
    this.selectedPayment.set(raw.selectedPayment);
    this.appointmentDate.set(raw.appointmentDate);
    this.address.set(raw.address);
    this.clientBookingStep.set(raw.clientBookingStep);
    this.parcelDeliveryType.set(raw.parcelDeliveryType);
    this.parcelNote.set(raw.parcelNote);
    this.parcelPickupAddress.set(raw.parcelPickupAddress);
    this.parcelDropoffAddress.set(raw.parcelDropoffAddress);
    this.parcelPickupContact.set(raw.parcelPickupContact);
    this.parcelDropoffContact.set(raw.parcelDropoffContact);
    this.parcels.set(raw.parcels);
    this.offerAmount.set(raw.offerAmount);
    this.customOfferTouched.set(raw.customOfferTouched);
    this.selectedOfferStep.set(raw.selectedOfferStep);
    this.scheduleAvailabilityCheck();
    return true;
  }

  private readClientReservationDraft(): ServiceProposalClientDraft | null {
    try {
      const raw = sessionStorage.getItem(this.clientReservationDraftKey());
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<ServiceProposalClientDraft>;
      const selectedPayment = this.normalizeDraftPayment(parsed.selectedPayment);
      const clientBookingStep = parsed.clientBookingStep === 'PRICE' ? 'PRICE' : 'DETAILS';

      return {
        selectedServiceId: typeof parsed.selectedServiceId === 'string' ? parsed.selectedServiceId : '',
        customServiceName: typeof parsed.customServiceName === 'string' ? parsed.customServiceName : '',
        selectedPayment,
        appointmentDate: typeof parsed.appointmentDate === 'string' ? parsed.appointmentDate : '',
        address: typeof parsed.address === 'string' ? parsed.address : '',
        clientBookingStep,
        parcelDeliveryType: typeof parsed.parcelDeliveryType === 'string' ? parsed.parcelDeliveryType : '',
        parcelNote: typeof parsed.parcelNote === 'string' ? parsed.parcelNote : '',
        parcelPickupAddress: typeof parsed.parcelPickupAddress === 'string' ? parsed.parcelPickupAddress : '',
        parcelDropoffAddress: typeof parsed.parcelDropoffAddress === 'string' ? parsed.parcelDropoffAddress : '',
        parcelPickupContact: this.normalizeDraftContact(parsed.parcelPickupContact),
        parcelDropoffContact: this.normalizeDraftContact(parsed.parcelDropoffContact),
        parcels: Array.isArray(parsed.parcels) ? parsed.parcels : [],
        offerAmount: Number.isFinite(Number(parsed.offerAmount)) ? Number(parsed.offerAmount) : 0,
        customOfferTouched: parsed.customOfferTouched === true,
        selectedOfferStep: this.offerSteps.includes(Number(parsed.selectedOfferStep))
          ? Number(parsed.selectedOfferStep)
          : 250,
      };
    } catch {
      this.clearClientReservationDraft();
      return null;
    }
  }

  private normalizeDraftPayment(value: unknown): PaymentMethod {
    return value === 'ORANGE_MONEY' || value === 'VISA' || value === 'WAVE'
      ? value
      : 'WAVE';
  }

  private normalizeDraftContact(value: unknown): ParcelContactDraft {
    if (!value || typeof value !== 'object') {
      return { name: '', phone: '' };
    }

    const contact = value as Partial<ParcelContactDraft>;
    return {
      name: typeof contact.name === 'string' ? contact.name : '',
      phone: typeof contact.phone === 'string' ? contact.phone : '',
    };
  }

  private clearClientReservationDraft(): void {
    try {
      sessionStorage.removeItem(this.clientReservationDraftKey());
    } catch {
      // Rien a faire si le navigateur bloque le stockage.
    }
  }

  private startAvailabilityRealtime(profileId: string): void {
    this.stopAvailabilityRealtime();
    this.availabilityRealtimeSubscription = this.availabilityRealtime
      .watchProfessional(profileId)
      .subscribe((event) => this.handleAvailabilityChanged(event));
  }

  private stopAvailabilityRealtime(): void {
    const profileId = this.detail()?.profile.id || this.profileId;
    if (profileId) {
      this.availabilityRealtime.stopWatching(profileId);
    }
    this.availabilityRealtimeSubscription?.unsubscribe();
    this.availabilityRealtimeSubscription = null;
  }

  private handleAvailabilityChanged(event: ProfessionalAvailabilityChangedEvent): void {
    const profileId = this.detail()?.profile.id || this.profileId;
    if (event.professionalId !== profileId || this.isProviderProposalMode) return;

    if (event.reason === 'service') {
      this.refreshProviderDetailAndAvailability(profileId);
      return;
    }

    this.scheduleAvailabilityCheck();
  }

  private refreshProviderDetailAndAvailability(profileId: string): void {
    this.servicesService.getProviderProfileDetail(profileId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        if (!detail.services.some((service) => service.id === this.selectedServiceId())) {
          this.selectedServiceId.set(detail.services.find((service) => service.estDisponible)?.id ?? '');
          this.availabilityStatus.set(null);
          this.availabilitySlots.set([]);
        }
        this.scheduleAvailabilityCheck();
      },
      error: () => this.scheduleAvailabilityCheck(),
    });
  }

  private resumeActiveClientProposal(service: BackendProfessionalDetailService): void {
    this.proposalService.findActiveProposalForService(service.id).subscribe({
      next: (proposal) => {
        if (proposal) {
          this.applyPendingProposalState(proposal);
        }
        this.isLoading.set(false);
        this.scheduleAvailabilityCheck();
      },
      error: () => {
        this.isLoading.set(false);
        this.scheduleAvailabilityCheck();
      },
    });
  }

  private applyPendingProposalState(
    proposal: NegotiationView,
    options: { fallbackAmount?: number; syncUrl?: boolean; startRefresh?: boolean } = {},
  ): void {
    this.pendingProposal.set(proposal);
    this.refreshLinkedReservationStatus(proposal);
    this.selectedServiceId.set(proposal.serviceId);
    this.offerAmount.set(proposal.montantCourant || options.fallbackAmount || 0);
    this.isProviderOfferDirty.set(false);

    if (proposal.statut === 'EN_ATTENTE_CLIENT') {
      this.selectedOfferStep.set(1000);
    }

    if (proposal.dateHeureProposee) {
      this.appointmentDate.set(this.toDateInputValue(new Date(proposal.dateHeureProposee)));
    }

    const proposedAddress = proposal.adresseClientProposee?.trim() || proposal.client?.adresse || '';
    if (proposedAddress) {
      this.address.set(proposedAddress);
    }

    if (options.syncUrl !== false) {
      this.syncNegotiationUrl(proposal);
    }

    if (options.startRefresh !== false) {
      this.startProposalRefresh(proposal.id);
    }

    this.loadMaterialQuotes(proposal.id);
  }

  private syncNegotiationUrl(proposal: NegotiationView): void {
    const currentNegotiationId = this.route.snapshot.queryParamMap.get('negotiationId');
    const currentServiceId = this.route.snapshot.queryParamMap.get('serviceId');
    if (currentNegotiationId === proposal.id && currentServiceId === proposal.serviceId) {
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        negotiationId: proposal.id,
        serviceId: proposal.serviceId,
        mode: this.isProviderProposalMode ? 'prestataire' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private safeReturnUrl(): string | null {
    return safeInternalUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  private syncAddressForCurrentTravelMode(): void {
    if (this.clientTravelsToProvider()) {
      const providerAddress = this.providerInterventionAddress();
      if (providerAddress) {
        this.address.set(providerAddress);
      }
      this.appointmentAddressCoordinate.set(null);
      return;
    }

    const providerAddress = this.providerInterventionAddress();
    const currentAddress = this.address().trim();
    if (!currentAddress || currentAddress === providerAddress) {
      this.address.set('');
      this.appointmentAddressCoordinate.set(null);
    }
  }

  private resolveAppointmentAddress(fallbackAddress = ''): string {
    if (this.clientTravelsToProvider()) {
      return this.providerInterventionAddress().trim();
    }

    return this.address().trim() || fallbackAddress.trim();
  }

  private resolveInitialAddress(detail: ProviderProfileDetail | null): string {
    const profile = detail?.profile;
    return profile?.utilisateur.adresse?.trim() || profile?.ville?.trim() || '';
  }

  private parcelReservationNotes(): string[] {
    return this.parcelService.reservationNotes({
      isParcelDeliveryService: this.isParcelDeliveryService(),
      parcels: this.parcels(),
      note: this.parcelNote(),
      pickupContact: this.parcelPickupContact(),
      dropoffContact: this.parcelDropoffContact(),
      deliveryType: this.parcelDeliveryType(),
      categoryLabel: this.categoryLabel(),
      pickupAddress: this.parcelPickupAddress(),
      dropoffAddress: this.parcelDropoffAddress(),
      pricingNotes: this.parcelPricingNotes(),
    });
  }

  private appointmentLocationNotes(): string[] {
    if (this.isParcelDeliveryService() || this.clientTravelsToProvider()) {
      return [];
    }

    const coordinate = this.appointmentAddressCoordinate();
    if (!coordinate) {
      return [];
    }

    return [
      `Adresse pointee sur carte: ${this.resolveAppointmentAddress()}.`,
      'Position exacte conservee pour le trajet.',
    ];
  }

  private reservationLocationNotes(): string[] {
    return [...this.parcelReservationNotes(), ...this.appointmentLocationNotes()];
  }

  private parcelPricingNotes(): string[] {
    if (!this.isParcelDeliveryService() || !this.parcelDistanceMeters()) {
      return [];
    }

    return [
      `Distance estimee: ${this.parcelDistanceLabel()}.`,
      `Tarif kilometrique: ${this.parcelPricePerKmLabel()}.`,
      `Prix calcule: ${this.formatAmount(this.parcelComputedPrice())} FCFA.`,
    ];
  }

  private buildProposalMessage(draft: ReservationDraft): string {
    return this.reservationBuilder.buildProposalMessage({
      draft,
      serviceName: this.customServiceName() || draft.service.nom || this.categoryLabel(),
      amountLabel: this.formatAmount(draft.amount),
      proposalDateLabel: this.formatProposalDate(draft.dateHeure),
      isParcelDeliveryService: this.isParcelDeliveryService(),
      parcelNotes: this.reservationLocationNotes(),
    });
  }

  private buildAcceptedReservationNotes(proposal: NegotiationView): string {
    return this.reservationBuilder.buildAcceptedReservationNotes({
      proposal,
      acceptedAmountLabel: this.formatAmount(proposal.montantCourant),
      parcelNotes: this.reservationLocationNotes(),
    });
  }

  private isValidAppointmentDate(): boolean {
    return this.proposalState.isValidAppointmentDate(this.appointmentDate());
  }

  private clearClientDetailsErrors(...fields: ClientDetailsField[]): void {
    if (fields.length === 0) {
      this.clientDetailsErrors.set({});
      return;
    }

    this.clientDetailsErrors.update((errors) => {
      const next = { ...errors };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  }

  private shouldStopProposalRefresh(proposal: NegotiationView): boolean {
    return this.proposalState.shouldStopProposalRefresh(proposal);
  }

  private refreshLinkedReservationStatus(proposal: NegotiationView): void {
    if (!proposal.reservationId) {
      this.linkedReservationStatus.set(null);
      this.linkedReservationCancellationReason.set(null);
      return;
    }

    this.proposalService.getReservation(proposal.reservationId).subscribe({
      next: (reservation) => {
        this.linkedReservationStatus.set(reservation.statut);
        this.linkedReservationCancellationReason.set(reservation.raisonAnnulation);
      },
      error: () => {
        this.linkedReservationStatus.set(null);
        this.linkedReservationCancellationReason.set(null);
      },
    });
  }

  private isLinkedReservationCancelled(): boolean {
    return this.linkedReservationStatus() === 'ANNULEE';
  }

  private validateClientDetailsStep(): boolean {
    const errors = this.collectClientDetailsErrors(true);

    this.clientDetailsErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private collectClientDetailsErrors(
    triggerAvailabilityCheck: boolean,
  ): Partial<Record<ClientDetailsField, string>> {
    const errors: Partial<Record<ClientDetailsField, string>> = {};
    const service = this.currentService();

    if (!service) {
      errors.service = 'Choisissez le motif de prestation avant de continuer.';
    }

    const dateHeure = this.toIsoDateTime(this.appointmentDate());
    if (!dateHeure || !this.isValidAppointmentDate()) {
      errors.schedule = 'Choisissez une date et une heure futures pour le rendez-vous.';
    }

    if (this.isCheckingAvailability() || this.isLoadingAvailabilitySlots()) {
      errors.availability = 'Patientez pendant la verification de la disponibilite du creneau.';
    } else if (service && dateHeure) {
      const availabilityStatus = this.availabilityStatus();
      if (!availabilityStatus || availabilityStatus.dateHeure !== dateHeure) {
        errors.availability = 'Selectionnez un creneau disponible avant de continuer.';
        if (triggerAvailabilityCheck) {
          this.checkAvailabilityNow(service, dateHeure);
        }
      } else if (!availabilityStatus.available) {
        errors.availability = availabilityStatus.reason || 'Ce creneau nest pas disponible.';
      }
    }

    if (this.isParcelDeliveryService()) {
      const describedParcels = this.parcels().filter((parcel) => parcel.description.trim().length >= 3);
      const pickupAddress = this.parcelPickupAddress().trim().replace(/\s+/g, ' ');
      const dropoffAddress = this.parcelDropoffAddress().trim().replace(/\s+/g, ' ');
      const pickupContact = this.parcelPickupContact();
      const dropoffContact = this.parcelDropoffContact();

      if (describedParcels.length === 0) {
        errors.parcels = 'Ajoutez au moins un colis avec une description claire.';
      }

      if (!this.parcelService.isValidContact(pickupContact)) {
        errors.pickupContact = "Renseignez le nom et le telephone de l'expediteur.";
      }

      if (pickupAddress.length < 5 || pickupAddress.length > 180) {
        errors.pickupAddress = 'Renseignez une adresse de depart entre 5 et 180 caracteres.';
      }

      if (!this.parcelService.isValidContact(dropoffContact)) {
        errors.dropoffContact = 'Renseignez le nom et le telephone du destinataire.';
      }

      if (dropoffAddress.length < 5 || dropoffAddress.length > 180) {
        errors.dropoffAddress = "Renseignez une adresse d'arrivee entre 5 et 180 caracteres.";
      }

      return errors;
    }

    const address = this.resolveAppointmentAddress().replace(/\s+/g, ' ');
    if (address.length < 5 || address.length > 180) {
      errors.address = this.clientTravelsToProvider()
        ? 'Adresse du prestataire non renseignee pour ce service.'
        : 'Renseignez une adresse precise entre 5 et 180 caracteres.';
    }

    return errors;
  }

  private validateReservationDraft(
    service: BackendProfessionalDetailService | null,
  ): ReservationDraft | null {
    if (!service) {
      this.feedback.info('Selectionnez un service valide avant de confirmer.');
      return null;
    }

    if (this.customServiceName() && service.typePrix !== 'NEGOCIABLE') {
      this.feedback.info(
        'Ce prestataire doit avoir au moins un service negociable disponible pour recevoir une offre personnalisee.',
      );
      return null;
    }

    const amount =
      !this.customServiceName() && service.typePrix === 'FIXE'
        ? Math.trunc(Number(service.prix))
        : Math.trunc(Number(this.offerAmount()));
    if (
      this.isParcelDeliveryService() &&
      service.typePrix === 'NEGOCIABLE' &&
      (!Number.isFinite(amount) || amount <= 0)
    ) {
      this.feedback.info(
        "Choisissez l'adresse de retrait et l'adresse de depot sur la carte pour calculer le prix de livraison.",
      );
      return null;
    }
    if (service.typePrix === 'FIXE' && (!Number.isFinite(amount) || amount <= 0)) {
      this.feedback.info('Ce service fixe doit avoir un tarif renseigne avant la reservation.');
      return null;
    }

    if (
      (this.customServiceName() || service.typePrix === 'NEGOCIABLE') &&
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

    const adresseClient = (
      this.isParcelDeliveryService()
        ? this.parcelDropoffAddress()
        : this.clientTravelsToProvider()
          ? this.providerInterventionAddress()
          : this.address()
    ).trim().replace(/\s+/g, ' ');
    if (adresseClient.length < 5 || adresseClient.length > 180) {
      this.feedback.info(
        this.clientTravelsToProvider()
          ? 'Adresse du prestataire non renseignee pour ce service.'
          : this.isParcelDeliveryService()
            ? "Renseignez une adresse d'arrivee precise entre 5 et 180 caracteres."
            : 'Renseignez une adresse precise entre 5 et 180 caracteres.',
      );
      return null;
    }

    if (
      !Number.isInteger(this.durationMinutes()) ||
      this.durationMinutes() < 5 ||
      this.durationMinutes() > 1440
    ) {
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
      dureeMinutes: this.durationMinutes(),
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

  private loadAvailabilitySlots(service: BackendProfessionalDetailService, date: string): void {
    this.isLoadingAvailabilitySlots.set(true);
    this.availabilitySlots.set([]);
    this.proposalService
      .listReservationAvailabilitySlots({
        professionalId: service.profilProfessionnelId,
        date,
        dureeMinutes: this.durationMinutes(),
        pauseMinutes: this.pauseMinutes(),
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
          } else if (selectedSlot) {
            this.availabilityStatus.set({
              available: false,
              reason: selectedSlot.reason || 'Ce creneau nest pas disponible.',
              professionalId: service.profilProfessionnelId,
              dateHeure: selectedSlot.dateHeure,
              dureeMinutes: this.durationMinutes(),
              withinAvailability: true,
              hasConflict: selectedSlot.status === 'RESERVED',
            });
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

  private humanMapAddressLabel(value: string): string {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }

  private resolveCustomNegotiationService(
    current: BackendProfessionalDetailService | null,
  ): BackendProfessionalDetailService | null {
    if (!this.customServiceName()) {
      return current;
    }

    if (current?.estDisponible && current.typePrix === 'NEGOCIABLE') {
      return current;
    }

    return (
      (this.detail()?.services ?? []).find(
        (service) => service.estDisponible && service.typePrix === 'NEGOCIABLE',
      ) ?? null
    );
  }

  private refreshParcelDeliveryPriceEstimate(): void {
    if (!this.isParcelDeliveryService()) {
      this.resetParcelDeliveryPricing();
      return;
    }

    const pickup = this.parcelPickupCoordinate();
    const dropoff = this.parcelDropoffCoordinate();
    const pricePerKm = this.parcelPricePerKm();
    const requestId = ++this.parcelPriceRequestId;

    if (!pickup || !dropoff || pricePerKm <= 0) {
      this.parcelDistanceMeters.set(null);
      this.isParcelPriceLoading.set(false);
      this.parcelPriceError.set(
        pricePerKm <= 0
          ? 'Tarif kilometrique non renseigne.'
          : 'Renseignez depart et arrivee pour calculer le prix.',
      );
      if (!this.isProviderProposalMode) {
        this.offerAmount.set(0);
      }
      return;
    }

    this.isParcelPriceLoading.set(true);
    this.parcelPriceError.set(null);
    this.googleMaps
      .computeRoutes({ origin: pickup, destination: dropoff })
      .pipe(catchError(() => of([])))
      .subscribe((routes) => {
        if (requestId !== this.parcelPriceRequestId) {
          return;
        }

        const routeDistance = routes.find((route) => Number(route.distanceMeters) > 0)
          ?.distanceMeters;
        const distanceMeters =
          typeof routeDistance === 'number' && routeDistance > 0
            ? routeDistance
          : this.parcelService.estimateRoadDistanceMeters(pickup, dropoff);

        this.parcelDistanceMeters.set(distanceMeters);
        this.isParcelPriceLoading.set(false);
        this.parcelPriceError.set(null);
        if (!this.isProviderProposalMode) {
          this.offerAmount.set(this.parcelComputedPrice());
        }
      });
  }

  private buildAcceptedNegotiationReservationPayload(
    proposal: NegotiationView,
  ): CreateReservationFromNegotiationPayload | null {
    const dateHeure = proposal.dateHeureProposee
      ? this.toIsoDateTime(proposal.dateHeureProposee)
      : this.toIsoDateTime(this.appointmentDate());
    const adresseClient =
      proposal.adresseClientProposee?.trim() ||
      this.resolveAppointmentAddress('').trim();
    const dureeMinutes = Number(
      proposal.dureeMinutesProposee ?? this.durationMinutes(),
    );

    return this.reservationBuilder.buildAcceptedNegotiationReservationPayload({
      proposal,
      dateHeure,
      adresseClient,
      dureeMinutes,
    });
  }

  private resetParcelDeliveryPricing(): void {
    this.parcelPriceRequestId += 1;
    this.parcelDistanceMeters.set(null);
    this.isParcelPriceLoading.set(false);
    this.parcelPriceError.set(null);
  }

  private serviceDurationMinutes(service: BackendProfessionalDetailService | null): number {
    return this.proposalState.serviceDurationMinutes(service);
  }

  private servicePauseMinutes(service: BackendProfessionalDetailService | null): number {
    return this.proposalState.servicePauseMinutes(service);
  }

  private checkAvailabilityNow(service: BackendProfessionalDetailService, dateHeure: string): void {
    this.isCheckingAvailability.set(true);
    this.proposalService
      .checkReservationAvailability({
        professionalId: service.profilProfessionnelId,
        dateHeure,
        dureeMinutes: this.durationMinutes(),
        pauseMinutes: this.pauseMinutes(),
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
            dureeMinutes: this.durationMinutes(),
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

    return this.reservationBuilder.buildFallbackReservationDraft({
      service,
      fallbackAmount,
      dateHeure:
        this.toIsoDateTime(this.appointmentDate()) ??
        this.getDefaultAppointmentDate().toISOString(),
      adresseClient: this.clientTravelsToProvider()
        ? this.providerInterventionAddress()
        : this.address().trim() || (detail ? this.resolveInitialAddress(detail) : ''),
      dureeMinutes: this.durationMinutes(),
      paymentMethod: this.selectedPayment(),
    });
  }

  private getDefaultAppointmentDate(): Date {
    return this.formatter.defaultAppointmentDate();
  }

  private toDateInputValue(date: Date): string {
    return this.formatter.toDateInputValue(date);
  }

  private toIsoDateTime(value: string): string | null {
    return this.formatter.toIsoDateTime(value);
  }

  private formatProposalDate(value: string): string {
    return this.formatter.formatProposalDate(value, this.formattedDate());
  }

  protected formatAmount(value: number): string {
    return this.formatter.formatAmount(value);
  }

  private formatDecimal(value: number, digits = 1): string {
    return this.formatter.formatDecimal(value, digits);
  }

  private toPositiveAmount(value: number | null | undefined): number | null {
    return this.formatter.toPositiveAmount(value);
  }

  private formatAcceptedDateTime(value: string): string {
    return this.formatter.formatAcceptedDateTime(value);
  }

  private formatAcceptedDate(value: string): string {
    return this.formatter.formatAcceptedDate(value);
  }

  private formatAcceptedTime(value: string): string {
    return this.formatter.formatAcceptedTime(value);
  }

  private truncate(value: string, maxLength: number): string {
    return this.formatter.truncate(value, maxLength);
  }
}
