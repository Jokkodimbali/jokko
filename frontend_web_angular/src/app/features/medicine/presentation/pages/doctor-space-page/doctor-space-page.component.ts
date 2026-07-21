import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, Subscription, forkJoin, of, timer } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { publicAssetUrl } from '../../../../../shared/utils/public-asset-url';
import { userInitials } from '../../../../../shared/utils/user-initials';
import {
  BackendProfessionalAvailability,
  BackendProfessionalDetailService,
  BackendProfessionalPortfolioItem,
  BackendProfessionalProfile,
  CategoryStructure,
  ProfessionalVehicleType,
  ServiceTravelMode,
} from '../../../../services/domain/models/services.models';
import {
  NegotiationStatus,
  NegotiationView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';
import { NegotiationsRealtimeService } from '../../../../services/data-access/negotiations-realtime.service';
import {
  ServiceProposalInteractiveMapComponent,
  ServiceProposalMapAddressSelection,
} from '../../../../services/presentation/components/service-proposal-interactive-map/service-proposal-interactive-map.component';
import {
  AppointmentStatus,
  BackendReservation,
} from '../../../../appointments/domain/appointments.models';
import { ReservationsRealtimeService } from '../../../../appointments/data-access/reservations-realtime.service';
import {
  DoctorSpaceService,
  PatientMedicalProfile,
  DoctorWalletPendingEscrow,
  DoctorWalletTransaction,
  DoctorWalletView,
  ProfessionalUploadView,
} from '../../../data-access/doctor-space.service';
import { DoctorSpaceSidebarComponent } from './components/doctor-space-sidebar/doctor-space-sidebar.component';

type DoctorSpaceSection =
  | 'profile'
  | 'availability'
  | 'consultation'
  | 'negotiations'
  | 'patient-appointments'
  | 'agenda'
  | 'medical-history'
  | 'wallet';

const DOCTOR_SPACE_SECTIONS: readonly DoctorSpaceSection[] = [
  'profile',
  'availability',
  'consultation',
  'negotiations',
  'patient-appointments',
  'agenda',
  'medical-history',
  'wallet',
];

type AvailabilitySlot = {
  id: string | null;
  startTime: string;
  endTime: string;
  isSaving?: boolean;
};

type AppointmentSlotPreview = {
  startTime: string;
  endTime: string;
};

type AvailabilityPreviewDay = {
  key: string;
  label: string;
  previews: AppointmentSlotPreview[];
};

type DaySchedule = {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  slots: AvailabilitySlot[];
};

type CalendarDay = {
  dayOfMonth: number;
  date: Date | null;
  isToday: boolean;
  isSelected: boolean;
  isOutside: boolean;
  isWorkingDay: boolean;
  isBlocked: boolean;
};

type ConsultationMotif = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  durationMinutes: number;
  pauseMinutes: number;
  price: number;
  isRequired: boolean;
  travelMode: ServiceTravelMode;
};

type TravelModeOption = {
  value: ServiceTravelMode;
  icon: string;
  title: string;
  description: string;
};

type VehicleOption = {
  value: ProfessionalVehicleType;
  title: string;
  imageUrl: string;
};

type AgendaFilter = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED' | 'DISPUTE';
type AgendaViewMode = 'day' | 'week' | 'month';
type MedicalHistoryTab = 'future' | 'past';
type ProviderHistoryFilter = 'ALL' | 'TERMINEE' | 'ANNULEE' | 'NO_SHOW';
type ProviderNegotiationFilter = 'ALL' | 'PENDING' | 'WAITING_CLIENT' | 'CONFIRMED' | 'CLOSED';

type ProviderNegotiationGroup = {
  key: string;
  label: string;
  items: NegotiationView[];
};

type ProviderReservationGroup = {
  key: string;
  label: string;
  items: BackendReservation[];
};

type ProviderNegotiationTimelineItem = NegotiationView & {
  timelineDate: Date;
  timelineKind: 'negotiation' | 'reservation';
  timelineReservation?: BackendReservation;
};

type ProviderNegotiationTimelineGroup = {
  key: string;
  label: string;
  items: ProviderNegotiationTimelineItem[];
};

type ProviderNegotiationCalendarDay = {
  key: string;
  day: number | null;
  count: number;
  dateKey: string | null;
};

const PROVIDER_HISTORY_PAGE_SIZE_OPTIONS = [8, 12, 20] as const;

type AgendaDay = {
  date: Date;
  dayLabel: string;
  dayNumber: string;
};

type AgendaEvent = {
  id: string;
  title: string;
  timeLabel: string;
  clientLabel: string;
  price: number;
  status: AppointmentStatus;
  statusLabel: string;
  dayIndex: number;
  rowStart: number;
  rowSpan: number;
  variant: 'pending' | 'confirmed' | 'paid' | 'active' | 'done' | 'cancelled' | 'absent' | 'dispute';
};

type AgendaReservationDetail = BackendReservation;

type NextAgendaReservationView = {
  reservation: BackendReservation;
  patientName: string;
  avatarUrl: string | null;
  initials: string;
  serviceName: string;
  locationLabel: string;
  timeLabel: string;
  dayLabel: string;
  monthLabel: string;
  durationLabel: string;
  delayLabel: string;
  progress: number;
  statusLabel: string;
  confirmationLabel: string;
};

type MedicalHistoryPatientOption = {
  id: string;
  label: string;
};

type MedicalHistoryDocument = {
  label: string;
  type: 'DOC';
};

type MedicalSpecialtyChip = {
  label: string;
  tone: 'red' | 'blue' | 'purple' | 'amber' | 'green' | 'gray' | 'mint' | 'pink';
};

type MedicalHistoryRow = {
  id: string;
  clientId: string;
  patientName: string;
  avatarUrl: string | null;
  serviceName: string;
  scheduledAt: Date;
  appointmentLabel: string;
  lastAppointmentLabel: string;
  isFuture: boolean;
  documents: MedicalHistoryDocument[];
};

type ProviderAppointmentHistoryRow = {
  id: string;
  clientName: string;
  avatarUrl: string | null;
  initials: string;
  serviceName: string;
  scheduledAt: Date;
  timeLabel: string;
  dateLabel: string;
  locationLabel: string;
  amount: number;
  status: AppointmentStatus;
  statusLabel: string;
  statusTone: 'done' | 'cancelled' | 'absent' | 'pending';
};

type ProviderHistoryMonthOption = {
  value: string;
  label: string;
};

type PatientMedicalDetail = MedicalHistoryRow & {
  reservation: BackendReservation;
  profile: PatientMedicalProfile;
  ageLabel: string;
  genderLabel: string;
  locationLabel: string;
  phoneLabel: string;
  alerts: string[];
  medicalActs: Array<{
    id: string;
    title: string;
    category: string;
    dateLabel: string;
  }>;
  availableSpecialties: MedicalSpecialtyChip[];
};

type WithdrawalMethodOption = {
  id: 'WAVE' | 'ORANGE_MONEY' | 'BANK_TRANSFER';
  label: string;
  detail: string;
  logoUrl?: string;
  enabled: boolean;
};

type ProfessionalProfileForm = {
  companyName: string;
  city: string;
  bio: string;
};

type ProfessionalKycForm = {
  idCardUrl: string;
  idCardUrlVerso: string;
};

type ProfessionalPortfolioForm = {
  title: string;
  description: string;
  imageUrl: string;
};

type ProfessionalUploadTarget = 'kyc-front' | 'kyc-back' | 'portfolio';

type UploadPreview = {
  url: string;
  name: string;
  mimeType: string;
  isImage: boolean;
  isLocal?: boolean;
};

@Component({
  selector: 'app-doctor-space-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    DoctorSpaceSidebarComponent,
    ServiceProposalInteractiveMapComponent,
  ],
  templateUrl: './doctor-space-page.component.html',
  styleUrl: './doctor-space-page.component.scss',
})
export class DoctorSpacePageComponent implements OnInit, OnDestroy {
  private readonly doctorSpaceService = inject(DoctorSpaceService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly negotiationsRealtime = inject(NegotiationsRealtimeService);
  private readonly reservationsRealtime = inject(ReservationsRealtimeService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private negotiationsRealtimeSubscription?: Subscription;
  private reservationsRealtimeSubscription?: Subscription;
  private professionalRealtimeFallbackSubscription?: Subscription;
  private isReservationsRefreshInProgress = false;

  protected readonly activeSection = signal<DoctorSpaceSection>('patient-appointments');
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isProfileSaving = signal(false);
  protected readonly isKycSubmitting = signal(false);
  protected readonly isPortfolioSaving = signal(false);
  protected readonly uploadingProfessionalAsset = signal<ProfessionalUploadTarget | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly professionalName = signal('Mon espace professionnel');
  protected readonly professionalProfile = signal<BackendProfessionalProfile | null>(null);
  protected readonly professionalProfileId = signal<string | null>(null);
  protected readonly portfolioItems = signal<BackendProfessionalPortfolioItem[]>([]);
  protected readonly days = signal<DaySchedule[]>(this.buildEmptyWeek());
  protected readonly motifs = signal<ConsultationMotif[]>([]);
  protected readonly editingMotifId = signal<string | null>(null);
  protected readonly editingMotif = signal<ConsultationMotif | null>(null);
  protected readonly categories = signal<CategoryStructure[]>([]);
  protected readonly reservations = signal<BackendReservation[]>([]);
  protected readonly negotiations = signal<NegotiationView[]>([]);
  protected readonly wallet = signal<DoctorWalletView | null>(null);
  protected readonly releasingEscrowId = signal<string | null>(null);
  protected readonly appointmentDuration = signal(0);
  protected readonly appointmentPause = signal(0);
  protected readonly selectedTravelMode = signal<ServiceTravelMode>('PRESTATAIRE_SE_DEPLACE');
  protected readonly selectedVehicleType = signal<ProfessionalVehicleType>('VOITURE');
  protected readonly interventionAddress = signal('');
  protected readonly interventionCoordinate = signal<{ latitude: number; longitude: number } | null>(null);
  protected readonly isInterventionMapExpanded = signal(false);
  protected readonly agendaCursor = signal(this.startOfDay(new Date()));
  protected readonly agendaFilter = signal<AgendaFilter>('ALL');
  protected readonly agendaViewMode = signal<AgendaViewMode>('day');
  protected readonly medicalHistoryTab = signal<MedicalHistoryTab>('future');
  protected readonly medicalHistorySearch = signal('');
  protected readonly medicalHistoryPatientFilter = signal('ALL');
  protected readonly providerHistorySearch = signal('');
  protected readonly providerHistoryFilter = signal<ProviderHistoryFilter>('ALL');
  protected readonly providerHistoryMonth = signal(this.monthInputValue(new Date()));
  protected readonly negotiationMonth = signal(this.monthInputValue(new Date()));
  protected readonly negotiationFilter = signal<ProviderNegotiationFilter>('ALL');
  protected readonly selectedNegotiationDate = signal<string | null>(null);
  protected readonly providerHistoryPage = signal(1);
  protected readonly providerHistoryPageSize = signal<(typeof PROVIDER_HISTORY_PAGE_SIZE_OPTIONS)[number]>(8);
  protected readonly selectedPatientDetail = signal<PatientMedicalDetail | null>(null);
  protected readonly selectedAgendaReservation = signal<AgendaReservationDetail | null>(null);
  protected readonly selectedAvailabilityPreviewKey = signal<string | null>(null);
  protected readonly isAgendaReservationLoading = signal(false);
  protected readonly isAgendaReservationCancelling = signal(false);
  protected readonly agendaReservationError = signal<string | null>(null);
  protected readonly isPatientDetailLoading = signal(false);
  protected readonly patientDetailError = signal<string | null>(null);
  protected readonly isWithdrawalModalOpen = signal(false);
  protected readonly agendaPeriodStart = signal('');
  protected readonly agendaPeriodEnd = signal('');
  protected readonly todayDate = signal(this.startOfDay(new Date()));
  protected readonly motifForm = {
    categoryId: '',
    name: '',
    durationMinutes: 15,
    price: 10000,
    isRequired: true,
  };
  protected readonly motifEditForm = {
    categoryId: '',
    name: '',
    durationMinutes: 15,
    price: 10000,
    isRequired: true,
    travelMode: 'PRESTATAIRE_SE_DEPLACE' as ServiceTravelMode,
  };
  protected readonly travelModeOptions: TravelModeOption[] = [
    {
      value: 'PRESTATAIRE_SE_DEPLACE',
      icon: 'wrench',
      title: 'Le prestataire se deplace',
      description: "Vous vous rendez chez le client a l'adresse indiquee lors de la reservation.",
    },
    {
      value: 'CLIENT_SE_DEPLACE',
      icon: 'map-pin',
      title: 'Le client se deplace',
      description: 'Le client vient vous retrouver a votre adresse ou point de rendez-vous defini.',
    },
    {
      value: 'TRANSPORT_COLIS',
      icon: 'clipboard',
      title: 'Transport de colis',
      description: 'Vous transportez un colis du point A au point B choisis par le client.',
    },
  ];
  protected readonly visibleTravelModeOptions = computed(() =>
    this.isProviderSpace()
      ? this.travelModeOptions
      : this.travelModeOptions.filter((option) => option.value !== 'TRANSPORT_COLIS'),
  );
  protected readonly vehicleOptions: VehicleOption[] = [
    {
      value: 'MOTO_SCOOTER',
      title: 'Moto / Scooter',
      imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/moto.png',
    },
    {
      value: 'VOITURE',
      title: 'Voiture',
      imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/voiture.png',
    },
    {
      value: 'CAMIONNETTE',
      title: 'Camionnette',
      imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/camionnette.png',
    },
  ];
  protected readonly shouldShowInterventionMap = computed(
    () => this.selectedTravelMode() === 'CLIENT_SE_DEPLACE',
  );
  protected readonly shouldShowVehicleChoice = computed(
    () => this.isProviderSpace() && this.selectedTravelMode() === 'TRANSPORT_COLIS',
  );
  protected readonly interventionAddressHint = computed(() => {
    const address = this.interventionAddress().trim();
    if (address) return address;
    return 'Selectionnez le point de rendez-vous sur la carte.';
  });
  protected readonly withdrawalForm = {
    amount: 0,
    method: 'WAVE' as 'WAVE' | 'ORANGE_MONEY',
  };
  protected readonly patientActForm = {
    specialty: '',
    title: '',
    date: '',
    doctorName: '',
    notes: '',
    documentName: '',
  };
  protected readonly agendaCancelForm = {
    reason: '',
  };
  protected readonly profileForm: ProfessionalProfileForm = {
    companyName: '',
    city: '',
    bio: '',
  };
  protected readonly kycForm: ProfessionalKycForm = {
    idCardUrl: '',
    idCardUrlVerso: '',
  };
  protected readonly kycFileNames: ProfessionalKycForm = {
    idCardUrl: '',
    idCardUrlVerso: '',
  };
  protected readonly kycFrontPreview = signal<UploadPreview | null>(null);
  protected readonly kycBackPreview = signal<UploadPreview | null>(null);
  protected readonly kycFrontFile = signal<File | null>(null);
  protected readonly kycBackFile = signal<File | null>(null);
  protected readonly portfolioForm: ProfessionalPortfolioForm = {
    title: '',
    description: '',
    imageUrl: '',
  };
  protected readonly portfolioFileName = signal('');
  protected readonly portfolioPreview = signal<UploadPreview | null>(null);
  protected readonly portfolioFile = signal<File | null>(null);
  protected readonly withdrawalMethods: WithdrawalMethodOption[] = [
    {
      id: 'WAVE',
      label: 'WAVE',
      detail: 'Instantané · 0 FCFA',
      logoUrl: '/wave.png',
      enabled: true,
    },
    {
      id: 'ORANGE_MONEY',
      label: 'Orange Money',
      detail: 'Instantané · 1% frais',
      logoUrl: '/Orange-Money-logo.png',
      enabled: true,
    },
    {
      id: 'BANK_TRANSFER',
      label: 'Virement bancaire',
      detail: '1-3 jours ouvrés',
      enabled: false,
    },
  ];
  protected readonly calendarCursor = signal(this.startOfMonth(new Date()));
  protected readonly blockedCalendarDates = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly isProviderSpace = computed(() =>
    this.router.url.startsWith('/prestataire/espace'),
  );
  protected readonly spaceAriaLabel = computed(() =>
    this.isProviderSpace() ? 'Espace prestataire' : 'Espace medecin',
  );
  protected readonly showConsultationSection = computed(() => true);
  protected readonly serviceSectionLabel = computed(() =>
    this.isProviderSpace() ? 'Mes services' : 'Services / motifs',
  );
  protected readonly appointmentHistorySectionLabel = computed(() =>
    this.isProviderSpace() ? 'Historique des RDV' : 'Historique médical',
  );
  protected readonly agendaSectionLabel = computed(() => 'Gestion RDV');
  protected readonly hasProfessionalProfile = computed(() => !!this.professionalProfileId());
  protected readonly kycStatusLabel = computed(() => {
    const status = this.professionalProfile()?.statutKyc;
    if (!status) return 'Profil a creer';
    const labels: Record<BackendProfessionalProfile['statutKyc'], string> = {
      NON_SOUMIS: 'Non soumis',
      EN_ATTENTE: 'En verification',
      VERIFIE: 'Verifie',
      REJETE: 'Rejete',
    };
    return labels[status];
  });
  protected readonly motifRequiredCount = computed(
    () => this.motifs().filter((motif) => motif.isRequired).length,
  );
  protected readonly motifAveragePrice = computed(() => {
    const motifs = this.motifs();
    if (motifs.length === 0) return 0;
    return Math.round(
      motifs.reduce((total, motif) => total + motif.price, 0) / motifs.length,
    );
  });
  protected readonly profileCompletionItems = computed(() => [
    {
      label: 'Profil',
      done: this.hasProfessionalProfile(),
      hint: this.hasProfessionalProfile() ? 'Fiche creee' : 'Nom, ville et bio',
    },
    {
      label: 'KYC',
      done: this.professionalProfile()?.statutKyc === 'VERIFIE',
      hint: this.kycStatusLabel(),
    },
    {
      label: this.serviceSectionLabel(),
      done: this.motifs().length > 0,
      hint: `${this.motifs().length} enregistre(s)`,
    },
    {
      label: 'Portfolio',
      done: this.portfolioItems().length > 0,
      hint: `${this.portfolioItems().length} realisation(s)`,
    },
  ]);
  protected readonly profileCompletionPercent = computed(() => {
    const items = this.profileCompletionItems();
    if (items.length === 0) return 0;
    return Math.round((items.filter((item) => item.done).length / items.length) * 100);
  });
  protected readonly defaultServicePriceType = computed<'FIXE' | 'NEGOCIABLE'>(() =>
    this.isProviderSpace() ? 'NEGOCIABLE' : 'FIXE',
  );
  protected readonly serviceFormTitle = computed(() =>
    this.isProviderSpace() ? 'Nouveau service' : 'Nouveau motif',
  );
  protected readonly serviceEditModalTitle = computed(() =>
    this.isProviderSpace() ? 'Modifier ce service' : 'Modifier ce motif',
  );
  protected readonly serviceFormSubtitle = computed(() =>
    this.isProviderSpace()
      ? this.isAddMotifParcelDelivery()
        ? 'Nommez votre service et indiquez le prix par kilometre negociable.'
        : 'Nommez votre service et indiquez le prix de depart negociable.'
      : 'Nommez le motif de consultation et indiquez le tarif fixe.',
  );
  protected readonly serviceNameLabel = computed(() =>
    this.isProviderSpace() ? 'Nom du service' : 'Nom du motif',
  );
  protected readonly serviceNamePlaceholder = computed(() =>
    this.isProviderSpace()
      ? 'Ex : Plomberie sanitaire, installation chauffe-eau'
      : 'Ex : Consultation generale',
  );
  protected readonly servicePriceHelp = computed(() =>
    this.isProviderSpace()
      ? this.isAddMotifParcelDelivery()
        ? "Prix par kilometre utilise pour calculer automatiquement le prix selon l'adresse de retrait et de depot. Le client pourra negocier."
        : 'Prix de depart affiche. Le client pourra negocier avec vous.'
      : 'Prix fixe affiche au client avant reservation.',
  );
  protected readonly serviceListTitle = computed(() =>
    this.isProviderSpace() ? 'Mes services et specialites' : 'Mes motifs',
  );
  protected readonly serviceEmptyLabel = computed(() =>
    this.isProviderSpace()
      ? 'Aucun service enregistre. Ajoutez au moins un service pour apparaitre clairement sur la page d accueil.'
      : 'Aucun motif de consultation enregistre.',
  );
  protected readonly servicePriceFieldLabel = computed(() =>
    this.isAddMotifParcelDelivery() ? 'Prix par kilometre (FCFA/km)' : 'Tarif (FCFA)',
  );
  protected readonly servicePriceFieldStep = computed(() =>
    this.isAddMotifParcelDelivery() ? 100 : 500,
  );

  protected editServicePriceFieldLabel(): string {
    return this.isEditMotifParcelDelivery() ? 'Prix par kilometre (FCFA/km)' : 'Tarif (FCFA)';
  }

  protected editServicePriceHelp(): string {
    if (!this.isProviderSpace()) {
      return 'Prix fixe affiche au client avant reservation.';
    }

    return this.isEditMotifParcelDelivery()
      ? "Prix par kilometre utilise pour calculer automatiquement le prix selon l'adresse de retrait et de depot. Le client pourra negocier."
      : 'Prix de depart affiche. Le client pourra negocier avec vous.';
  }

  protected editServicePriceFieldStep(): number {
    return this.isEditMotifParcelDelivery() ? 100 : 500;
  }

  protected motifPriceUnitLabel(motif: ConsultationMotif): string {
    return motif.travelMode === 'TRANSPORT_COLIS' ? 'FCFA/km' : 'FCFA';
  }

  protected readonly calendarDays = computed(() =>
    this.buildCalendarDays(
      this.calendarCursor(),
      this.days(),
      this.blockedCalendarDates(),
    ),
  );
  protected readonly blockedCalendarDateLabels = computed(() =>
    Array.from(this.blockedCalendarDates())
      .sort()
      .map((key) => ({
        key,
        label: this.formatBlockedCalendarDate(key),
      })),
  );
  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: 'numeric',
    }).format(this.calendarCursor()),
  );
  protected readonly durationProgress = computed(() =>
    this.progressPercent(this.appointmentDuration(), 0, 90),
  );
  protected readonly pauseProgress = computed(() =>
    this.progressPercent(this.appointmentPause(), 0, 60),
  );
  protected readonly appointmentStepMinutes = computed(() =>
    this.appointmentDuration() + this.appointmentPause(),
  );
  protected readonly weeklyAppointmentCapacity = computed(() =>
    this.days().reduce((total, day) => total + this.dayAppointmentCapacity(day), 0),
  );
  protected readonly availabilityPreviewDays = computed(() => this.buildAvailabilityPreviewDays());
  protected readonly agendaWeekDays = computed(() => this.buildAgendaWeekDays(this.agendaCursor()));
  protected readonly agendaDateLabel = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
      .format(this.agendaCursor())
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
  );
  protected readonly agendaWeekLabel = computed(() => {
    const start = this.startOfWeek(this.agendaCursor());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startLabel = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(start);
    const endLabel = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(end);
    return `Semaine du ${startLabel} au ${endLabel}`;
  });
  protected readonly agendaRows = computed(() => this.buildAgendaRows());
  protected readonly agendaEvents = computed(() => this.buildAgendaEvents());
  protected readonly agendaRevenue = computed(() =>
    this.sumPeriodRevenue((status) => this.isAgendaRevenueStatus(status)),
  );
  protected readonly agendaCancelledRevenue = computed(() =>
    this.sumPeriodRevenue((status) => status === 'ANNULEE' || status === 'NO_SHOW'),
  );
  protected readonly nextAgendaReservation = computed(() => this.buildNextAgendaReservationView());
  protected readonly agendaNextDelayLabel = computed(() => this.nextAgendaReservation()?.delayLabel ?? '--');
  protected readonly agendaPeriodCaption = computed(() => {
    switch (this.agendaViewMode()) {
      case 'day':
        return 'Ce jour';
      case 'week':
        return 'Cette semaine';
      case 'month':
        return 'Ce mois';
    }
  });
  protected readonly agendaZoomPercent = computed(() => {
    return this.appointmentStepMinutes();
  });
  protected readonly agendaRowHeight = computed(() => {
    const minutes = this.appointmentStepMinutes();
    if (minutes >= 75) return 48;
    if (minutes >= 60) return 42;
    if (minutes >= 45) return 36;
    if (minutes >= 30) return 31;
    return 34;
  });
  protected readonly medicalHistoryRows = computed(() => this.buildMedicalHistoryRows());
  protected readonly medicalHistoryFutureRows = computed(() =>
    this.medicalHistoryRows().filter((row) => row.isFuture),
  );
  protected readonly medicalHistoryPastRows = computed(() =>
    this.medicalHistoryRows().filter((row) => !row.isFuture),
  );
  protected readonly medicalHistoryVisibleRows = computed(() => {
    const selectedRows =
      this.medicalHistoryTab() === 'future'
        ? this.medicalHistoryFutureRows()
        : this.medicalHistoryPastRows();
    const search = this.medicalHistorySearch().trim().toLowerCase();
    const patientFilter = this.medicalHistoryPatientFilter();

    return selectedRows.filter((row) => {
      const matchesPatient = patientFilter === 'ALL' || row.clientId === patientFilter;
      const matchesSearch =
        !search ||
        row.patientName.toLowerCase().includes(search) ||
        row.serviceName.toLowerCase().includes(search);
      return matchesPatient && matchesSearch;
    });
  });
  protected readonly medicalHistoryPatients = computed<MedicalHistoryPatientOption[]>(() => {
    const patients = new Map<string, string>();
    for (const reservation of this.reservations()) {
      patients.set(reservation.clientId, this.clientLabel(reservation));
    }
    return Array.from(patients, ([id, label]) => ({ id, label })).sort((left, right) =>
      left.label.localeCompare(right.label, 'fr'),
    );
  });
  protected readonly providerHistoryRows = computed(() => this.buildProviderHistoryRows());
  protected readonly providerHistoryMonthOptions = computed<ProviderHistoryMonthOption[]>(() => {
    const months = new Map<string, Date>();
    for (const row of this.providerHistoryRows()) {
      const value = this.monthInputValue(row.scheduledAt);
      if (!months.has(value)) {
        months.set(value, new Date(row.scheduledAt.getFullYear(), row.scheduledAt.getMonth(), 1));
      }
    }

    if (!months.has(this.providerHistoryMonth())) {
      const fallback = this.parseMonthValue(this.providerHistoryMonth()) ?? new Date();
      months.set(this.providerHistoryMonth(), new Date(fallback.getFullYear(), fallback.getMonth(), 1));
    }

    return Array.from(months, ([value, date]) => ({
      value,
      label: this.formatProviderHistoryMonth(date),
    })).sort((left, right) => right.value.localeCompare(left.value));
  });
  protected readonly providerHistoryMonthRows = computed(() => {
    const selectedMonth = this.providerHistoryMonth();
    return this.providerHistoryRows().filter((row) => this.monthInputValue(row.scheduledAt) === selectedMonth);
  });
  protected readonly providerHistoryVisibleRows = computed(() => {
    const search = this.providerHistorySearch().trim().toLowerCase();
    const filter = this.providerHistoryFilter();

    return this.providerHistoryMonthRows().filter((row) => {
      const matchesFilter = filter === 'ALL' || row.status === filter;
      const matchesSearch =
        !search ||
        row.clientName.toLowerCase().includes(search) ||
        row.serviceName.toLowerCase().includes(search) ||
        row.locationLabel.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  });
  protected readonly providerHistoryPageSizeOptions = PROVIDER_HISTORY_PAGE_SIZE_OPTIONS;
  protected readonly providerHistoryTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.providerHistoryVisibleRows().length / this.providerHistoryPageSize())),
  );
  protected readonly providerHistoryCurrentPage = computed(() =>
    Math.min(this.providerHistoryPage(), this.providerHistoryTotalPages()),
  );
  protected readonly providerHistoryPagedRows = computed(() => {
    const page = this.providerHistoryCurrentPage();
    const pageSize = this.providerHistoryPageSize();
    const start = (page - 1) * pageSize;
    return this.providerHistoryVisibleRows().slice(start, start + pageSize);
  });
  protected readonly providerHistoryPageStart = computed(() => {
    if (this.providerHistoryVisibleRows().length === 0) return 0;
    return (this.providerHistoryCurrentPage() - 1) * this.providerHistoryPageSize() + 1;
  });
  protected readonly providerHistoryPageEnd = computed(() =>
    Math.min(
      this.providerHistoryPageStart() + this.providerHistoryPagedRows().length - 1,
      this.providerHistoryVisibleRows().length,
    ),
  );
  protected readonly providerHistoryTotalCount = computed(() => this.providerHistoryMonthRows().length);
  protected readonly providerHistoryMonthLabel = computed(() => {
    const month = this.parseMonthValue(this.providerHistoryMonth()) ?? new Date();
    return this.formatProviderHistoryMonth(month);
  });
  protected readonly providerHistoryTotalRevenue = computed(() =>
    this.sumProviderRows(this.providerHistoryMonthRows().filter((row) => row.status === 'TERMINEE')),
  );
  protected readonly providerHistoryDoneCount = computed(
    () => this.providerHistoryMonthRows().filter((row) => row.status === 'TERMINEE').length,
  );
  protected readonly providerHistoryCancelledCount = computed(
    () => this.providerHistoryMonthRows().filter((row) => row.status === 'ANNULEE').length,
  );
  protected readonly providerHistoryAbsentCount = computed(
    () => this.providerHistoryMonthRows().filter((row) => row.status === 'NO_SHOW').length,
  );
  protected readonly providerHistoryVisibleTotal = computed(() => this.sumProviderRows(this.providerHistoryVisibleRows()));
  protected readonly negotiationMonthOptions = computed(() => {
    const months = new Map<string, Date>();
    for (const negotiation of this.negotiations()) {
      const date = this.negotiationDate(negotiation);
      months.set(this.monthInputValue(date), new Date(date.getFullYear(), date.getMonth(), 1));
    }
    for (const reservation of this.reservations()) {
      const date = new Date(reservation.dateHeure);
      if (!Number.isNaN(date.getTime())) {
        months.set(this.monthInputValue(date), new Date(date.getFullYear(), date.getMonth(), 1));
      }
    }
    if (!months.has(this.negotiationMonth())) {
      const selected = this.parseMonthValue(this.negotiationMonth()) ?? new Date();
      months.set(this.negotiationMonth(), selected);
    }
    return Array.from(months, ([value, date]) => ({
      value,
      label: this.formatProviderHistoryMonth(date),
    })).sort((left, right) => right.value.localeCompare(left.value));
  });
  protected readonly negotiationMonthRows = computed(() =>
    this.negotiations().filter(
      (negotiation) => this.monthInputValue(this.negotiationDate(negotiation)) === this.negotiationMonth(),
    ),
  );
  protected readonly negotiationVisibleRows = computed(() =>
    this.negotiationMonthRows().filter((negotiation) => {
      if (negotiation.reservationId) return false;
      const selectedDate = this.selectedNegotiationDate();
      if (selectedDate && this.dateInputValue(this.negotiationDate(negotiation)) !== selectedDate) return false;
      const filter = this.negotiationFilter();
      if (filter === 'ALL') return true;
      if (filter === 'PENDING') return negotiation.statut === 'EN_ATTENTE_PRESTATAIRE';
      if (filter === 'WAITING_CLIENT') return negotiation.statut === 'EN_ATTENTE_CLIENT' || negotiation.statut === 'ACCEPTEE';
      if (filter === 'CLOSED') return negotiation.statut === 'REFUSEE' || negotiation.statut === 'ANNULEE';
      return false;
    }),
  );
  protected readonly negotiationGroups = computed<ProviderNegotiationGroup[]>(() => {
    const groups = new Map<string, NegotiationView[]>();
    for (const negotiation of this.negotiationVisibleRows()) {
      const key = this.dateInputValue(this.negotiationDate(negotiation));
      groups.set(key, [...(groups.get(key) ?? []), negotiation]);
    }
    return Array.from(groups, ([key, items]) => ({
      key,
      label: new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(this.negotiationDate(items[0])).toUpperCase(),
      items: this.sortNegotiationsByDate(items),
    })).sort((left, right) => right.key.localeCompare(left.key));
  });
  protected readonly negotiationTimelineGroups = computed<ProviderNegotiationTimelineGroup[]>(() => {
    const groups = new Map<string, ProviderNegotiationTimelineItem[]>();
    const addItem = (item: ProviderNegotiationTimelineItem) => {
      const key = this.dateInputValue(item.timelineDate);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    };

    for (const negotiation of this.negotiationVisibleRows()) {
      addItem({
        ...negotiation,
        timelineDate: this.negotiationDate(negotiation),
        timelineKind: 'negotiation',
      });
    }

    for (const reservation of this.negotiationReservationVisibleRows()) {
      addItem(this.reservationToNegotiationTimelineItem(reservation));
    }

    return Array.from(groups, ([key, items]) => ({
      key,
      label: new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(items[0].timelineDate).toUpperCase(),
      items: this.sortTimelineByDate(items),
    })).sort((left, right) => right.key.localeCompare(left.key));
  });
  protected readonly negotiationReservationMonthRows = computed(() =>
    this.reservations().filter(
      (reservation) => this.monthInputValue(new Date(reservation.dateHeure)) === this.negotiationMonth(),
    ),
  );
  protected readonly negotiationReservationVisibleRows = computed(() =>
    this.negotiationReservationMonthRows().filter((reservation) => {
      const selectedDate = this.selectedNegotiationDate();
      if (selectedDate && this.dateInputValue(new Date(reservation.dateHeure)) !== selectedDate) return false;
      const filter = this.negotiationFilter();
      if (filter === 'ALL') return true;
      if (filter === 'CONFIRMED') {
        return (
          reservation.statut === 'CONFIRMEE' ||
          reservation.statut === 'PAYEE_SEQUESTRE' ||
          reservation.statut === 'EN_COURS' ||
          reservation.statut === 'TERMINEE'
        );
      }
      if (filter === 'CLOSED') {
        return reservation.statut === 'ANNULEE' || reservation.statut === 'NO_SHOW' || reservation.statut === 'LITIGE';
      }
      return false;
    }),
  );
  protected readonly negotiationReservationGroups = computed<ProviderReservationGroup[]>(() => {
    const groups = new Map<string, BackendReservation[]>();
    for (const reservation of this.negotiationReservationVisibleRows()) {
      const date = new Date(reservation.dateHeure);
      const key = this.dateInputValue(date);
      groups.set(key, [...(groups.get(key) ?? []), reservation]);
    }
    return Array.from(groups, ([key, items]) => ({
      key,
      label: new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date(items[0].dateHeure)).toUpperCase(),
      items: this.sortReservationsByDate(items),
    })).sort((left, right) => right.key.localeCompare(left.key));
  });

  private sortNegotiationsByDate(negotiations: NegotiationView[]): NegotiationView[] {
    return [...negotiations].sort((left, right) =>
      this.compareDatesDescending(this.negotiationDate(left), this.negotiationDate(right)),
    );
  }

  private sortReservationsByDate(reservations: BackendReservation[]): BackendReservation[] {
    return [...reservations].sort((left, right) =>
      this.compareDatesDescending(new Date(left.dateHeure), new Date(right.dateHeure)),
    );
  }

  private sortTimelineByDate(items: ProviderNegotiationTimelineItem[]): ProviderNegotiationTimelineItem[] {
    return [...items].sort((left, right) => this.compareDatesDescending(left.timelineDate, right.timelineDate));
  }

  private reservationToNegotiationTimelineItem(reservation: BackendReservation): ProviderNegotiationTimelineItem {
    const servicePrice = reservation.prixConvenu ?? reservation.service?.prix ?? 0;
    const reservationDate = new Date(reservation.dateHeure);

    return {
      id: reservation.id,
      clientId: reservation.clientId,
      professionnelId: reservation.professionnelId,
      serviceId: reservation.serviceId,
      statut: reservation.statut as unknown as NegotiationStatus,
      montantInitial: servicePrice,
      montantCourant: servicePrice,
      montantAccepte: servicePrice,
      dernierProposePar: 'CLIENT',
      messageCourant: reservation.notes,
      dateHeureProposee: reservation.dateHeure,
      adresseClientProposee: reservation.adresseClient,
      dureeMinutesProposee: reservation.dureeMinutes,
      reservationId: reservation.id,
      creeLe: reservation.creeLe,
      misAJourLe: reservation.misAJourLe,
      client: reservation.client
        ? {
            id: reservation.client.id,
            nom: reservation.client.nom,
            adresse: reservation.adresseClient,
            urlAvatar: reservation.client.urlAvatar,
          }
        : undefined,
      service: reservation.service
        ? {
            id: reservation.service.id,
            nom: reservation.service.nom,
            prix: servicePrice,
          }
        : undefined,
      timelineDate: reservationDate,
      timelineKind: 'reservation',
      timelineReservation: reservation,
    };
  }

  private compareDatesDescending(left: Date, right: Date): number {
    const leftTime = left.getTime();
    const rightTime = right.getTime();
    const leftInvalid = Number.isNaN(leftTime);
    const rightInvalid = Number.isNaN(rightTime);

    if (leftInvalid && rightInvalid) return 0;
    if (leftInvalid) return 1;
    if (rightInvalid) return -1;

    return rightTime - leftTime;
  }

  protected readonly negotiationCalendarDays = computed<ProviderNegotiationCalendarDay[]>(() => {
    const month = this.parseMonthValue(this.negotiationMonth()) ?? new Date();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const leading = (firstDay.getDay() + 6) % 7;
    const counts = new Map<string, number>();
    for (const negotiation of this.negotiationMonthRows()) {
      const key = this.dateInputValue(this.negotiationDate(negotiation));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const reservation of this.negotiationReservationMonthRows()) {
      const key = this.dateInputValue(new Date(reservation.dateHeure));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from({ length: leading + daysInMonth }, (_, index) => {
      if (index < leading) return { key: `blank-${index}`, day: null, count: 0, dateKey: null };
      const day = index - leading + 1;
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const key = this.dateInputValue(date);
      return { key, day, count: counts.get(key) ?? 0, dateKey: key };
    });
  });
  protected readonly negotiationAllCount = computed(() =>
    this.negotiationMonthRows().filter((negotiation) => !negotiation.reservationId).length +
    this.negotiationReservationMonthRows().length,
  );
  protected readonly negotiationPendingCount = computed(() =>
    this.negotiationMonthRows().filter(
      (negotiation) => !negotiation.reservationId && negotiation.statut === 'EN_ATTENTE_PRESTATAIRE',
    ).length,
  );
  protected readonly negotiationWaitingClientCount = computed(() =>
    this.negotiationMonthRows().filter(
      (negotiation) =>
        !negotiation.reservationId &&
        (negotiation.statut === 'EN_ATTENTE_CLIENT' || negotiation.statut === 'ACCEPTEE'),
    ).length,
  );
  protected readonly negotiationConfirmedCount = computed(() =>
    this.negotiationReservationMonthRows().filter(
      (reservation) =>
        reservation.statut === 'CONFIRMEE' ||
        reservation.statut === 'PAYEE_SEQUESTRE' ||
        reservation.statut === 'EN_COURS' ||
        reservation.statut === 'TERMINEE',
    ).length,
  );
  protected readonly negotiationClosedCount = computed(() =>
    this.negotiationMonthRows().filter(
      (negotiation) =>
        !negotiation.reservationId &&
        (negotiation.statut === 'REFUSEE' || negotiation.statut === 'ANNULEE'),
    ).length +
    this.negotiationReservationMonthRows().filter(
      (reservation) =>
        reservation.statut === 'ANNULEE' ||
        reservation.statut === 'NO_SHOW' ||
        reservation.statut === 'LITIGE',
    ).length,
  );
  protected readonly pageTitle = computed(() => {
    switch (this.activeSection()) {
      case 'profile':
        return 'Profil professionnel';
      case 'availability':
        return 'Mes disponibilités';
      case 'consultation':
        return this.isProviderSpace() ? 'Mes services' : 'Services et motifs';
      case 'negotiations':
        return 'RDV et Négociation clients';
      case 'patient-appointments':
        return 'RDV patients';
      case 'agenda':
        return this.agendaSectionLabel();
      case 'medical-history':
        return this.isProviderSpace() ? 'Historique des rendez-vous' : 'Historique médical';
      case 'wallet':
        return 'WALLET';
    }
  });
  protected readonly pageSubtitle = computed(() => {
    switch (this.activeSection()) {
      case 'profile':
        return 'Completez votre fiche publique, vos justificatifs KYC et vos realisations.';
      case 'availability':
        return "Vos modifications s'appliquent immédiatement à l'agenda des rendez-vous";
      case 'consultation':
        return 'Définissez les motifs du patient. Les motifs obligatoires devront être cochés à la prise de rendez-vous';
      case 'negotiations':
        return '';
      case 'patient-appointments':
        return '';
      case 'agenda':
        return '';
      case 'medical-history':
        return this.isProviderSpace()
          ? `${this.providerHistoryTotalCount()} rendez-vous · ${this.providerHistoryMonthLabel()}`
          : 'Consultez les informations médicales liées aux rendez-vous et aux patients.';
      case 'wallet':
        return 'Suivez vos revenus et retirez vos gains via Wave, Orange Money ou virement bancaire.';
    }
  });

  ngOnInit(): void {
    this.activeSection.set(this.resolveSectionFromRoute());
    this.loadSchedule();
  }

  ngOnDestroy(): void {
    this.negotiationsRealtimeSubscription?.unsubscribe();
    this.reservationsRealtimeSubscription?.unsubscribe();
    this.professionalRealtimeFallbackSubscription?.unsubscribe();
    this.negotiationsRealtime.stopWatching('PRESTATAIRE');
    this.reservationsRealtime.stopWatching('PRESTATAIRE');
  }

  protected goBack(): void {
    this.backNavigation.back(
      this.route.snapshot.queryParamMap.get('returnUrl'),
      '/services',
    );
  }

  private resolveSectionFromRoute(): DoctorSpaceSection {
    if (this.router.url.startsWith('/medecine/espace/rdv-patients')) {
      return 'patient-appointments';
    }

    const section = this.route.snapshot.queryParamMap.get('section');
    if (section === 'profile') return this.defaultSectionForSpace();
    if (section === 'patient-appointments' && this.isProviderSpace()) return 'negotiations';
    if (section === 'negotiations' && !this.isProviderSpace()) return 'patient-appointments';
    return DOCTOR_SPACE_SECTIONS.includes(section as DoctorSpaceSection)
      ? (section as DoctorSpaceSection)
      : this.defaultSectionForSpace();
  }

  private defaultSectionForSpace(): DoctorSpaceSection {
    return this.isProviderSpace() ? 'negotiations' : 'patient-appointments';
  }

  private setActiveSection(section: DoctorSpaceSection): void {
    this.activeSection.set(section);
    if (!this.isProviderSpace() && section === 'patient-appointments') {
      this.router.navigate(['/medecine/espace/rdv-patients'], {
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected selectSection(section: DoctorSpaceSection): void {
    if (section !== 'profile' && !this.professionalProfileId()) {
      this.feedback.info('Completez votre profil professionnel dans les parametres pour activer cette section.');
      this.router.navigate(['/settings'], { queryParams: { section: 'health' } });
      return;
    }

    if (section === 'consultation' && !this.showConsultationSection()) {
      this.setActiveSection('availability');
      return;
    }

    this.setActiveSection(section);
    if (section === 'patient-appointments') {
      this.refreshReservations();
    }
    if (section === 'negotiations') {
      this.refreshReservations();
      this.refreshNegotiations();
    }
    if (section === 'wallet') {
      this.refreshWallet();
    }
  }

  protected selectAgendaFilter(filter: AgendaFilter): void {
    this.agendaFilter.set(filter);
  }

  protected selectAgendaViewMode(mode: AgendaViewMode): void {
    this.agendaViewMode.set(mode);
  }

  protected selectMedicalHistoryTab(tab: MedicalHistoryTab): void {
    this.medicalHistoryTab.set(tab);
  }

  protected saveProfessionalProfile(): void {
    const payload = {
      companyName: this.profileForm.companyName.trim() || null,
      city: this.profileForm.city.trim() || null,
      bio: this.profileForm.bio.trim() || null,
    };
    const hasContent = !!(payload.companyName || payload.city || payload.bio);

    if (!hasContent) {
      this.feedback.info('Renseignez au moins un nom professionnel, une ville ou une biographie.');
      return;
    }

    const isUpdate = !!this.professionalProfileId();
    const request$ = isUpdate
      ? this.doctorSpaceService.updateMyProfessionalProfile(payload)
      : this.doctorSpaceService.createMyProfessionalProfile(payload);

    this.isProfileSaving.set(true);
    request$
      .pipe(finalize(() => this.isProfileSaving.set(false)))
      .subscribe({
        next: (profile) => {
          this.professionalProfile.set(profile);
          this.professionalProfileId.set(profile.id);
          this.professionalName.set(profile.utilisateur.nom);
          this.patchProfileForm(profile);
          this.feedback.success(
            isUpdate ? 'Profil professionnel enregistre.' : 'Profil professionnel cree.',
          );
          this.loadSchedule();
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Enregistrement du profil impossible.')),
      });
  }

  protected submitProfessionalKyc(): void {
    const idCardUrl = this.kycForm.idCardUrl.trim();
    const idCardUrlVerso = this.kycForm.idCardUrlVerso.trim();
    const frontFile = this.kycFrontFile();
    const backFile = this.kycBackFile();

    if (!this.professionalProfileId()) {
      this.feedback.info('Creez votre profil professionnel avant de soumettre le KYC.');
      return;
    }

    if (!idCardUrl && !frontFile) {
      this.feedback.info('Ajoutez le document recto avant de soumettre le KYC.');
      return;
    }

    this.isKycSubmitting.set(true);
    this.uploadingProfessionalAsset.set(frontFile ? 'kyc-front' : backFile ? 'kyc-back' : null);
    forkJoin({
      front: frontFile ? this.doctorSpaceService.uploadProfessionalAsset(frontFile) : of(null),
      back: backFile ? this.doctorSpaceService.uploadProfessionalAsset(backFile) : of(null),
    })
      .pipe(
        switchMap(({ front, back }) =>
          this.doctorSpaceService.submitMyKyc({
            idCardUrl: publicAssetUrl(front?.fileUrl ?? idCardUrl) ?? front?.fileUrl ?? idCardUrl,
            ...((back?.fileUrl ?? idCardUrlVerso)
              ? {
                  idCardUrlVerso:
                    publicAssetUrl(back?.fileUrl ?? idCardUrlVerso) ?? back?.fileUrl ?? idCardUrlVerso,
                }
              : {}),
          }),
        ),
        finalize(() => {
          this.isKycSubmitting.set(false);
          this.uploadingProfessionalAsset.set(null);
        }),
      )
      .subscribe({
        next: (profile) => {
          this.professionalProfile.set(profile);
          this.patchProfileForm(profile);
          this.kycForm.idCardUrl = '';
          this.kycForm.idCardUrlVerso = '';
          this.kycFileNames.idCardUrl = '';
          this.kycFileNames.idCardUrlVerso = '';
          this.kycFrontFile.set(null);
          this.kycBackFile.set(null);
          this.kycFrontPreview.set(null);
          this.kycBackPreview.set(null);
          this.feedback.success('Dossier KYC soumis pour verification.');
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Soumission KYC impossible.')),
      });
  }

  protected selectProfessionalAsset(event: Event, target: ProfessionalUploadTarget): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (!this.isValidProfessionalAsset(file, target)) {
      input.value = '';
      return;
    }

    const preview = this.toLocalUploadPreview(file);
    if (target === 'kyc-front') {
      this.kycFrontFile.set(file);
      this.kycFileNames.idCardUrl = file.name;
      this.kycFrontPreview.set(preview);
      this.kycForm.idCardUrl = '';
    } else if (target === 'kyc-back') {
      this.kycBackFile.set(file);
      this.kycFileNames.idCardUrlVerso = file.name;
      this.kycBackPreview.set(preview);
      this.kycForm.idCardUrlVerso = '';
    } else {
      this.portfolioFile.set(file);
      this.portfolioFileName.set(file.name);
      this.portfolioPreview.set(preview);
      this.portfolioForm.imageUrl = '';
    }
  }

  protected addPortfolioItem(): void {
    const title = this.portfolioForm.title.trim();
    const description = this.portfolioForm.description.trim();
    const imageUrl = this.portfolioForm.imageUrl.trim();
    const file = this.portfolioFile();

    if (!this.professionalProfileId()) {
      this.feedback.info('Creez votre profil professionnel avant d ajouter un portfolio.');
      return;
    }

    if (!title || (!imageUrl && !file)) {
      this.feedback.info('Renseignez le titre et choisissez une image du portfolio.');
      return;
    }

    this.isPortfolioSaving.set(true);
    this.uploadingProfessionalAsset.set(file ? 'portfolio' : null);
    const upload$ = file
      ? this.doctorSpaceService.uploadProfessionalAsset(file)
      : of(null as ProfessionalUploadView | null);
    upload$
      .pipe(
        switchMap((uploaded) =>
          this.doctorSpaceService.createPortfolioItem({
            title,
            imageUrl:
              publicAssetUrl(uploaded?.imageUrl || uploaded?.fileUrl || imageUrl) ??
              uploaded?.imageUrl ??
              uploaded?.fileUrl ??
              imageUrl,
            description: description || null,
          }),
        ),
        finalize(() => {
          this.isPortfolioSaving.set(false);
          this.uploadingProfessionalAsset.set(null);
        }),
      )
      .subscribe({
        next: (item) => {
          this.portfolioItems.update((items) => [
            { ...item, urlImage: publicAssetUrl(item.urlImage) ?? item.urlImage },
            ...items,
          ]);
          this.portfolioForm.title = '';
          this.portfolioForm.description = '';
          this.portfolioForm.imageUrl = '';
          this.portfolioFileName.set('');
          this.portfolioPreview.set(null);
          this.portfolioFile.set(null);
          this.feedback.success('Element portfolio ajoute.');
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Ajout du portfolio impossible.')),
      });
  }

  protected deletePortfolioItem(item: BackendProfessionalPortfolioItem): void {
    this.isPortfolioSaving.set(true);
    this.doctorSpaceService
      .deletePortfolioItem(item.id)
      .pipe(finalize(() => this.isPortfolioSaving.set(false)))
      .subscribe({
        next: () => {
          this.portfolioItems.update((items) => items.filter((current) => current.id !== item.id));
          this.feedback.success('Element portfolio supprime.');
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Suppression du portfolio impossible.')),
      });
  }

  protected updateMedicalHistorySearch(value: string): void {
    this.medicalHistorySearch.set(value);
  }

  protected updateMedicalHistoryPatientFilter(value: string): void {
    this.medicalHistoryPatientFilter.set(value);
  }

  protected updateProviderHistorySearch(value: string): void {
    this.providerHistorySearch.set(value);
    this.resetProviderHistoryPagination();
  }

  protected selectProviderHistoryFilter(filter: ProviderHistoryFilter): void {
    this.providerHistoryFilter.set(filter);
    this.resetProviderHistoryPagination();
  }

  protected updateProviderHistoryMonth(value: string): void {
    this.providerHistoryMonth.set(value);
    this.resetProviderHistoryPagination();
  }

  protected selectNegotiationFilter(filter: ProviderNegotiationFilter): void {
    this.negotiationFilter.set(filter);
  }

  protected selectNegotiationCalendarDay(day: ProviderNegotiationCalendarDay): void {
    if (!day.dateKey) return;
    this.selectedNegotiationDate.update((selected) => selected === day.dateKey ? null : day.dateKey);
  }

  protected updateNegotiationMonth(value: string): void {
    this.negotiationMonth.set(value);
    this.selectedNegotiationDate.set(null);
  }

  protected shiftNegotiationMonth(direction: -1 | 1): void {
    const month = this.parseMonthValue(this.negotiationMonth()) ?? new Date();
    month.setMonth(month.getMonth() + direction);
    this.negotiationMonth.set(this.monthInputValue(month));
    this.selectedNegotiationDate.set(null);
  }

  protected openNegotiation(negotiation: NegotiationView): void {
    if (negotiation.reservationId) {
      this.openReservationDetail(negotiation.reservationId);
      return;
    }

    this.router.navigate(['/services', negotiation.professionnelId, 'proposition'], {
      queryParams: {
        negotiationId: negotiation.id,
        serviceId: negotiation.serviceId,
        mode: 'prestataire',
        returnUrl: this.router.url,
      },
    });
  }

  protected negotiationStatusLabel(status: NegotiationStatus | AppointmentStatus): string {
    const labels: Partial<Record<NegotiationStatus | AppointmentStatus, string>> = {
      EN_ATTENTE_PRESTATAIRE: 'À valider',
      EN_ATTENTE_CLIENT: 'Attente client',
      ACCEPTEE: 'Prix accepté',
      REFUSEE: 'Refusée',
      ANNULEE: 'Annulée',
      CONVERTIE_EN_RESERVATION: 'Confirmé',
    };
    return labels[status] ?? this.negotiationReservationStatusLabel(status as AppointmentStatus);
  }


  protected negotiationTone(negotiation: NegotiationView): string {
    if (this.isTimelineReservation(negotiation)) return this.negotiationReservationTone(negotiation.statut as AppointmentStatus);
    if (negotiation.statut === 'EN_ATTENTE_PRESTATAIRE') return 'pending';
    if (negotiation.statut === 'EN_ATTENTE_CLIENT') return 'counter';
    if (negotiation.statut === 'ACCEPTEE') return 'accepted';
    if (negotiation.statut === 'CONVERTIE_EN_RESERVATION') return 'confirmed';
    if (negotiation.statut === 'REFUSEE') return 'rejected';
    return 'cancelled';
  }

  protected negotiationClientName(negotiation: NegotiationView): string {
    return negotiation.client?.nom || `Client ${negotiation.clientId.slice(0, 6).toUpperCase()}`;
  }

  protected negotiationInitials(negotiation: NegotiationView): string {
    return this.initialsForName(this.negotiationClientName(negotiation));
  }

  protected negotiationDateValue(negotiation: NegotiationView): Date {
    return this.negotiationDate(negotiation);
  }

  protected negotiationLocation(negotiation: NegotiationView): string {
    return negotiation.adresseClientProposee || negotiation.client?.adresse || 'Lieu à confirmer';
  }

  protected negotiationPhoneHref(negotiation: NegotiationView): string | null {
    const reservation = this.timelineReservationFor(negotiation);
    if (reservation) return this.negotiationReservationPhoneHref(reservation);

    const phone = (negotiation.client as { numeroTelephone?: string } | undefined)?.numeroTelephone?.trim();
    return phone ? `tel:${phone.replace(/\s+/g, '')}` : null;
  }

  protected isClosedNegotiation(negotiation: NegotiationView): boolean {
    if (this.isTimelineReservation(negotiation)) return false;
    return negotiation.statut === 'REFUSEE' || negotiation.statut === 'ANNULEE';
  }

  protected negotiationCardTitle(negotiation: NegotiationView): string {
    if (this.isClosedNegotiation(negotiation)) {
      return 'Prix propose';
    }

    return negotiation.service?.nom || 'Service';
  }


  protected negotiationAmountValue(negotiation: NegotiationView): number {
    return negotiation.montantAccepte || negotiation.montantCourant || negotiation.montantInitial || 0;
  }

  protected negotiationMessageQueryParams(negotiation: NegotiationView): Record<string, string> {
    const reservation = this.timelineReservationFor(negotiation);
    if (reservation) return this.negotiationReservationMessageQueryParams(reservation);

    return {
      negotiationId: negotiation.id,
      professionalId: negotiation.professionnelId,
      returnUrl: this.router.url,
    };
  }

  private isTimelineReservation(negotiation: NegotiationView): boolean {
    return (negotiation as Partial<ProviderNegotiationTimelineItem>).timelineKind === 'reservation';
  }

  private timelineReservationFor(negotiation: NegotiationView): BackendReservation | null {
    return (negotiation as Partial<ProviderNegotiationTimelineItem>).timelineReservation ?? null;
  }


  protected openNegotiationReservation(reservation: BackendReservation): void {
    this.openReservationDetail(reservation.id);
  }

  protected negotiationReservationClientName(reservation: BackendReservation): string {
    return reservation.client?.nom || `Client ${reservation.clientId.slice(0, 6).toUpperCase()}`;
  }

  protected negotiationReservationInitials(reservation: BackendReservation): string {
    return this.initialsForName(this.negotiationReservationClientName(reservation));
  }

  protected negotiationReservationPhoneHref(reservation: BackendReservation): string | null {
    const phone = reservation.client?.numeroTelephone?.trim();
    return phone ? `tel:${phone.replace(/\s+/g, '')}` : null;
  }

  protected negotiationReservationMessageQueryParams(reservation: BackendReservation): Record<string, string> {
    return {
      reservationId: reservation.id,
      returnUrl: this.router.url,
    };
  }

  protected formatPatientInitials(name: string): string {
    return this.initialsForName(name);
  }

  protected negotiationReservationStatusLabel(status: AppointmentStatus): string {
    return this.agendaReservationStatusLabel(status);
  }

  protected negotiationReservationTone(status: AppointmentStatus): string {
    if (status === 'ANNULEE' || status === 'NO_SHOW') return 'cancelled';
    if (status === 'LITIGE') return 'rejected';
    return 'confirmed';
  }

  protected updateProviderHistoryPageSize(value: string | number): void {
    const pageSize = Number(value);
    if (PROVIDER_HISTORY_PAGE_SIZE_OPTIONS.some((option) => option === pageSize)) {
      this.providerHistoryPageSize.set(pageSize as (typeof PROVIDER_HISTORY_PAGE_SIZE_OPTIONS)[number]);
      this.resetProviderHistoryPagination();
    }
  }

  protected goToProviderHistoryPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.providerHistoryTotalPages());
    this.providerHistoryPage.set(nextPage);
  }

  protected previousProviderHistoryPage(): void {
    this.goToProviderHistoryPage(this.providerHistoryPage() - 1);
  }

  protected nextProviderHistoryPage(): void {
    this.goToProviderHistoryPage(this.providerHistoryPage() + 1);
  }

  protected openProviderHistoryReservation(row: ProviderAppointmentHistoryRow): void {
    this.openReservationDetail(row.id);
  }

  protected openPatientMedicalDetail(row: MedicalHistoryRow): void {
    const reservation = this.reservations().find((item) => item.id === row.id);
    if (!reservation) {
      this.feedback.error('Impossible de retrouver le rendez-vous selectionne.');
      return;
    }

    this.isPatientDetailLoading.set(true);
    this.patientDetailError.set(null);
    this.selectedPatientDetail.set(null);

    this.doctorSpaceService
      .getPatientMedicalProfile(row.clientId)
      .pipe(finalize(() => this.isPatientDetailLoading.set(false)))
      .subscribe({
        next: (profile) => {
          this.selectedPatientDetail.set(this.buildPatientMedicalDetail(row, reservation, profile));
        },
        error: (error: unknown) => {
          this.patientDetailError.set(
            getHttpErrorMessage(error, 'Impossible de charger la fiche medicale du patient.'),
          );
        },
      });
  }

  protected closePatientMedicalDetail(): void {
    this.selectedPatientDetail.set(null);
    this.patientDetailError.set(null);
  }

  protected hasMedicalProfileValue(value: string | number | null | undefined): boolean {
    return value !== null && value !== undefined && `${value}`.trim().length > 0;
  }

  protected medicalValue(value: string | number | null | undefined, suffix = ''): string {
    if (!this.hasMedicalProfileValue(value)) return 'Non renseigne';
    return `${value}${suffix}`;
  }

  protected selectPatientActSpecialty(label: string): void {
    this.patientActForm.specialty = label;
  }

  protected onPatientActDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.patientActForm.documentName = input.files?.[0]?.name ?? '';
  }

  protected submitPatientAct(): void {
    this.feedback.error(
      "L'enregistrement d'un acte medical patient necessite encore l'endpoint backend dedie.",
    );
  }

  protected walletBalance(): number {
    return this.wallet()?.availableBalance ?? 0;
  }

  protected walletTotalBalance(): number {
    return (
      this.wallet()?.totalCollected ??
      this.walletBalance() + this.walletPendingEscrowTotal()
    );
  }

  protected walletMonthlyRevenue(): number {
    return this.wallet()?.monthlyRevenue.amount ?? 0;
  }

  protected walletMonthlyChangeLabel(): string {
    const change = this.wallet()?.monthlyRevenue.changePercent ?? 0;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change} % vs mois precedent`;
  }

  protected walletMonthlyChangePercent(): number {
    return this.wallet()?.monthlyRevenue.changePercent ?? 0;
  }

  protected walletConsultationCount(): number {
    return this.wallet()?.monthlyRevenue.consultationCount ?? 0;
  }

  protected walletTeleconsultationCount(): number {
    return this.wallet()?.monthlyRevenue.teleconsultationCount ?? 0;
  }

  protected walletRefundedCancellationCount(): number {
    return this.wallet()?.monthlyRevenue.refundedCancellationCount ?? 0;
  }

  protected walletTransactions(): DoctorWalletTransaction[] {
    return this.wallet()?.transactions ?? [];
  }

  protected walletPendingEscrow(): DoctorWalletPendingEscrow[] {
    return this.wallet()?.pendingEscrow ?? [];
  }

  protected walletPendingEscrowTotal(): number {
    return this.walletPendingEscrow().reduce(
      (total, escrow) => total + Number(escrow.netAmount || escrow.amount || 0),
      0,
    );
  }

  protected escrowReleaseStatusLabel(escrow: DoctorWalletPendingEscrow): string {
    if (escrow.reservationStatus === 'TERMINEE') return 'Pret a liberer';
    if (escrow.reservationStatus === 'LITIGE') return 'Bloque par un litige';
    if (escrow.reservationStatus === 'ANNULEE') return 'Annule ou remboursable';
    return 'Bloque jusqu a la fin de la prestation';
  }

  protected canRequestEscrowRelease(escrow: DoctorWalletPendingEscrow): boolean {
    return escrow.canRequestRelease && this.releasingEscrowId() !== escrow.paymentId;
  }

  protected requestEscrowRelease(escrow: DoctorWalletPendingEscrow): void {
    if (!this.canRequestEscrowRelease(escrow)) {
      return;
    }

    this.releasingEscrowId.set(escrow.paymentId);
    this.doctorSpaceService
      .releaseEscrow(escrow.paymentId)
      .pipe(finalize(() => this.releasingEscrowId.set(null)))
      .subscribe({
        next: () => {
          this.feedback.success('Fonds liberes dans votre portefeuille.');
          this.refreshWallet();
        },
        error: (error) =>
          this.feedback.error(
            getHttpErrorMessage(error, 'Impossible de liberer ces fonds.'),
          ),
      });
  }

  protected openWithdrawalModal(): void {
    const balance = Math.floor(this.walletBalance());
    this.withdrawalForm.amount = balance >= 2000 ? Math.min(balance, 50000) : 0;
    this.isWithdrawalModalOpen.set(true);
  }

  protected closeWithdrawalModal(): void {
    if (this.isSaving()) return;
    this.isWithdrawalModalOpen.set(false);
  }

  protected selectWithdrawalMethod(method: WithdrawalMethodOption): void {
    if (!method.enabled || method.id === 'BANK_TRANSFER') return;
    this.withdrawalForm.method = method.id;
  }

  protected requestWalletWithdrawal(): void {
    const amount = Number(this.withdrawalForm.amount);
    if (!Number.isFinite(amount) || amount < 2000) {
      this.feedback.info('Le montant minimum de retrait est de 2000 FCFA.');
      return;
    }

    if (amount > this.walletBalance()) {
      this.feedback.info('Le montant depasse le solde disponible.');
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .requestWithdrawal({
        amount,
        method: this.withdrawalForm.method,
      })
      .pipe(
        switchMap(() => this.doctorSpaceService.getWallet()),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (wallet) => {
          this.wallet.set(wallet);
          this.withdrawalForm.amount = 0;
          this.isWithdrawalModalOpen.set(false);
          this.feedback.success('Retrait demande avec succes.');
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Retrait impossible.')),
      });
  }

  protected zoomAgendaIn(): void {
    this.updateAppointmentDuration(Math.min(90, this.appointmentDuration() + 5));
    this.persistAppointmentSettings();
  }

  protected zoomAgendaOut(): void {
    this.updateAppointmentDuration(Math.max(0, this.appointmentDuration() - 5));
    this.persistAppointmentSettings();
  }

  protected openAgendaReservation(event: AgendaEvent): void {
    this.openAgendaReservationById(event.id);
  }

  protected openNextAgendaReservation(next: NextAgendaReservationView): void {
    this.openReservationDetail(next.reservation.id);
  }

  private openReservationDetail(reservationId: string): void {
    this.router.navigate(['/appointments', reservationId], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  private openAgendaReservationById(reservationId: string): void {
    this.isAgendaReservationLoading.set(true);
    this.agendaReservationError.set(null);
    this.selectedAgendaReservation.set(null);
    this.agendaCancelForm.reason = '';

    this.doctorSpaceService
      .getReservationById(reservationId)
      .pipe(finalize(() => this.isAgendaReservationLoading.set(false)))
      .subscribe({
        next: (reservation) => {
          this.selectedAgendaReservation.set(reservation);
          this.mergeReservation(reservation);
        },
        error: (error: unknown) => {
          this.agendaReservationError.set(
            getHttpErrorMessage(error, 'Impossible de charger le detail de cette reservation.'),
          );
        },
      });
  }

  protected closeAgendaReservation(): void {
    if (this.isAgendaReservationCancelling()) return;
    this.selectedAgendaReservation.set(null);
    this.agendaReservationError.set(null);
    this.agendaCancelForm.reason = '';
  }

  protected canCancelAgendaReservation(reservation: BackendReservation): boolean {
    return (
      !this.isCancelledStatus(reservation.statut) &&
      reservation.statut !== 'TERMINEE' &&
      reservation.statut !== 'LITIGE' &&
      this.isMoreThanHoursBefore(reservation.dateHeure, 24)
    );
  }

  protected cancelAgendaReservation(reservation: BackendReservation): void {
    if (!this.canCancelAgendaReservation(reservation) || this.isAgendaReservationCancelling()) {
      return;
    }

    const reason =
      this.agendaCancelForm.reason.trim() ||
      'Annulation demandee depuis l agenda professionnel.';
    this.isAgendaReservationCancelling.set(true);
    this.agendaReservationError.set(null);

    this.doctorSpaceService
      .cancelReservation(reservation.id, reason)
      .pipe(finalize(() => this.isAgendaReservationCancelling.set(false)))
      .subscribe({
        next: (updated) => {
          this.mergeReservation(updated);
          this.selectedAgendaReservation.set(updated);
          this.agendaCancelForm.reason = '';
          this.feedback.success('Reservation annulee et client notifie.');
        },
        error: (error: unknown) => {
          this.agendaReservationError.set(
            getHttpErrorMessage(error, 'Annulation impossible pour cette reservation.'),
          );
        },
      });
  }

  protected agendaReservationStatusLabel(status: AppointmentStatus): string {
    const labels: Record<AppointmentStatus, string> = {
      CONFIRMEE: 'Confirmee',
      PAYEE_SEQUESTRE: 'Payee et confirmee',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminee',
      ANNULEE: 'Annulée',
      NO_SHOW: 'Absent',
      LITIGE: 'Litige',
    };

    return labels[status];
  }

  protected agendaReservationDateLabel(reservation: BackendReservation): string {
    const date = new Date(reservation.dateHeure);
    if (Number.isNaN(date.getTime())) return 'Date non renseignee';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  protected agendaReservationEndTimeLabel(reservation: BackendReservation): string {
    const date = new Date(reservation.dateHeure);
    if (Number.isNaN(date.getTime())) return '--:--';
    const end = new Date(date.getTime() + reservation.dureeMinutes * 60 * 1000);
    return this.formatAgendaTime(end);
  }

  protected agendaReservationPrice(reservation: BackendReservation): number {
    return Number(reservation.prixConvenu ?? reservation.service?.prix ?? 0);
  }

  protected agendaReservationServiceName(reservation: BackendReservation): string {
    return reservation.service?.nom ?? 'Service non renseigne';
  }

  protected agendaReservationCategoryName(reservation: BackendReservation): string {
    return reservation.service?.categorie?.nom ?? 'Categorie non renseignee';
  }

  protected previousAgendaWeek(): void {
    this.shiftAgendaPeriod(-1);
  }

  protected nextAgendaWeek(): void {
    this.shiftAgendaPeriod(1);
  }

  protected goToTodayAgenda(): void {
    const today = this.startOfDay(new Date());
    this.todayDate.set(today);
    this.agendaCursor.set(today);
  }

  protected isAgendaDayActive(date: Date): boolean {
    return this.isSameDay(date, this.agendaCursor());
  }

  protected isSameAgendaDay(left: Date, right: Date): boolean {
    return this.isSameDay(left, right);
  }

  protected updateAgendaPeriodStart(value: string): void {
    this.agendaPeriodStart.set(value);
  }

  protected updateAgendaPeriodEnd(value: string): void {
    this.agendaPeriodEnd.set(value);
  }

  protected toggleDay(day: DaySchedule): void {
    if (this.isSaving()) return;
    const hasSlots = day.slots.length > 0;
    if (hasSlots) {
      this.disableDay(day);
      return;
    }

    this.createDefaultSlots(day.dayOfWeek);
  }

  protected addSlot(day: DaySchedule): void {
    if (this.isSaving()) return;
    const nextSlot = this.getNextSlot(day.slots);
    this.createSlot(day.dayOfWeek, nextSlot.startTime, nextSlot.endTime);
  }

  protected removeSlot(day: DaySchedule, slot: AvailabilitySlot): void {
    if (this.isSaving()) return;
    if (!slot.id) {
      this.days.update((days) =>
        days.map((item) =>
          item.dayOfWeek === day.dayOfWeek
            ? { ...item, slots: item.slots.filter((candidate) => candidate !== slot) }
            : item,
        ),
      );
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .deleteAvailability(slot.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.applyAvailabilities(
            this.days()
              .flatMap((item) =>
                item.slots
                  .filter((candidate) => candidate.id && candidate.id !== slot.id)
                  .map((candidate) =>
                    this.toAvailability(item.dayOfWeek, candidate.id!, candidate.startTime, candidate.endTime),
                  ),
              ),
          );
          this.feedback.success('Disponibilite supprimee.');
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Suppression impossible.')),
      });
  }

  protected saveSlot(day: DaySchedule, slot: AvailabilitySlot): void {
    if (this.isSaving() || !this.isValidSlot(slot)) return;

    if (!slot.id) {
      this.createSlot(day.dayOfWeek, slot.startTime, slot.endTime);
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .updateAvailability(slot.id, {
        dayOfWeek: day.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Horaire mis a jour.');
          this.refreshAvailabilities();
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Mise a jour impossible.'));
          this.refreshAvailabilities();
        },
      });
  }

  protected trackDay(_index: number, day: DaySchedule): number {
    return day.dayOfWeek;
  }

  protected trackSlot(_index: number, slot: AvailabilitySlot): string {
    return slot.id ?? `${slot.startTime}-${slot.endTime}`;
  }

  protected trackAgendaDay(_index: number, day: AgendaDay): string {
    return day.date.toISOString();
  }

  protected trackAgendaRow(_index: number, row: string): string {
    return row;
  }

  protected trackAgendaEvent(_index: number, event: AgendaEvent): string {
    return event.id;
  }

  protected updateAppointmentDuration(value: string | number): void {
    const duration = this.normalizeMinutes(value, 0, 90);
    this.appointmentDuration.set(duration);
    this.motifForm.durationMinutes = duration;
  }

  protected updateAppointmentPause(value: string | number): void {
    this.appointmentPause.set(this.normalizeMinutes(value, 0, 60));
  }

  protected selectTravelMode(mode: ServiceTravelMode): void {
    if (!this.isProviderSpace() && mode === 'TRANSPORT_COLIS') {
      this.selectedTravelMode.set('PRESTATAIRE_SE_DEPLACE');
      return;
    }

    this.selectedTravelMode.set(mode);
    if (mode === 'TRANSPORT_COLIS' && this.motifForm.price === 10000) {
      this.motifForm.price = 500;
    }
  }

  protected updateInterventionAddress(address: string): void {
    this.interventionAddress.set(address);
  }

  protected resolveInterventionAddress(selection: ServiceProposalMapAddressSelection): void {
    this.interventionAddress.set(selection.address);
    this.interventionCoordinate.set(selection.coordinate);
  }

  protected setInterventionMapExpanded(expanded: boolean): void {
    this.isInterventionMapExpanded.set(expanded);
  }

  protected selectVehicleType(vehicleType: ProfessionalVehicleType): void {
    this.selectedVehicleType.set(vehicleType);
  }

  protected saveTravelMode(): void {
    const selectedMode = this.selectedTravelMode();
    const mode =
      !this.isProviderSpace() && selectedMode === 'TRANSPORT_COLIS'
        ? 'PRESTATAIRE_SE_DEPLACE'
        : selectedMode;
    const motifs = this.motifs().filter((motif) => motif.travelMode !== mode);
    const mustSaveInterventionLocation = mode === 'CLIENT_SE_DEPLACE';
    const interventionAddress = this.interventionAddress().trim();
    const interventionCoordinate = this.interventionCoordinate();

    if (mustSaveInterventionLocation && !this.professionalProfileId()) {
      this.feedback.info('Creez votre profil professionnel avant de definir cette adresse.');
      return;
    }

    if (mustSaveInterventionLocation && (!interventionAddress || !interventionCoordinate)) {
      this.feedback.info("Selectionnez l'adresse d'intervention directement sur la carte.");
      return;
    }

    if (motifs.length === 0 && !mustSaveInterventionLocation && !this.professionalProfileId()) {
      this.feedback.success('Mode de deplacement enregistre.');
      return;
    }

    const shouldSaveVehicleType = mode === 'TRANSPORT_COLIS';
    const profileUpdatePayload: {
      city?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      vehicleType?: ProfessionalVehicleType;
    } = {};

    if (shouldSaveVehicleType) {
      profileUpdatePayload.vehicleType = this.selectedVehicleType();
    }

    if (mustSaveInterventionLocation) {
      profileUpdatePayload.city = interventionAddress;
      profileUpdatePayload.latitude = interventionCoordinate?.latitude ?? null;
      profileUpdatePayload.longitude = interventionCoordinate?.longitude ?? null;
    }

    const profileUpdate$: Observable<BackendProfessionalProfile | null> =
      this.professionalProfileId() && Object.keys(profileUpdatePayload).length > 0
        ? this.doctorSpaceService.updateMyProfessionalProfile(profileUpdatePayload)
        : of(null);

    this.isSaving.set(true);
    profileUpdate$
      .pipe(
        switchMap((profile: BackendProfessionalProfile | null) => {
          if (profile) {
            this.professionalProfile.set(profile);
            this.professionalProfileId.set(profile.id);
            this.professionalName.set(profile.utilisateur.nom);
            this.patchProfileForm(profile);
          }

          return motifs.length > 0
            ? forkJoin(
                motifs.map((motif) =>
                  this.doctorSpaceService.updateService(motif.id, { travelMode: mode }),
                ),
              )
            : of([]);
        }),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: () => {
          this.feedback.success(
            mustSaveInterventionLocation
              ? "Mode et adresse d'intervention mis a jour."
              : shouldSaveVehicleType
                ? 'Mode de deplacement et vehicule mis a jour.'
                : 'Mode de deplacement mis a jour.',
          );
          if (motifs.length > 0) {
            this.refreshServices();
          }
        },
        error: (error: unknown) =>
          this.feedback.error(
            getHttpErrorMessage(error, "Mise a jour du mode de deplacement impossible."),
          ),
      });
  }

  private isAddMotifParcelDelivery(): boolean {
    return this.isProviderSpace() && this.selectedTravelMode() === 'TRANSPORT_COLIS';
  }

  private isEditMotifParcelDelivery(): boolean {
    return this.isProviderSpace() && this.motifEditForm.travelMode === 'TRANSPORT_COLIS';
  }

  protected persistAppointmentSettings(): void {
    this.syncMotifDurationsWithAppointmentDuration();
  }

  protected dayAppointmentCapacity(day: DaySchedule): number {
    if (!day.enabled) return 0;
    return day.slots.reduce((total, slot) => total + this.availabilitySlotCapacity(slot), 0);
  }

  protected availabilitySlotCapacity(slot: AvailabilitySlot): number {
    return this.buildAppointmentSlotPreviews(slot).length;
  }

  protected availabilitySlotPreviews(slot: AvailabilitySlot): AppointmentSlotPreview[] {
    return this.buildAppointmentSlotPreviews(slot).slice(0, 6);
  }

  protected dayAppointmentPreviews(day: DaySchedule): AppointmentSlotPreview[] {
    if (!day.enabled) return [];
    return day.slots.flatMap((slot) => this.buildAppointmentSlotPreviews(slot));
  }

  protected remainingAvailabilitySlotCount(slot: AvailabilitySlot): number {
    return Math.max(0, this.availabilitySlotCapacity(slot) - this.availabilitySlotPreviews(slot).length);
  }

  protected timeOptionsFor(...currentValues: string[]): string[] {
    const step = Math.max(5, this.appointmentStepMinutes());
    const options = new Set<string>();
    for (let minutes = 0; minutes < 24 * 60; minutes += step) {
      options.add(this.minutesToTime(minutes));
    }

    currentValues
      .filter((value) => /^\d{2}:\d{2}$/.test(value))
      .forEach((value) => options.add(value));

    return Array.from(options).sort((left, right) => this.timeToMinutes(left) - this.timeToMinutes(right));
  }

  protected selectAvailablePreview(day: AvailabilityPreviewDay, preview: AppointmentSlotPreview): void {
    this.selectedAvailabilityPreviewKey.set(this.availabilityPreviewKey(day, preview));
  }

  protected isAvailablePreviewSelected(day: AvailabilityPreviewDay, preview: AppointmentSlotPreview): boolean {
    return this.selectedAvailabilityPreviewKey() === this.availabilityPreviewKey(day, preview);
  }

  protected previousYear(): void {
    this.shiftCalendar(-12);
  }

  protected previousMonth(): void {
    this.shiftCalendar(-1);
  }

  protected nextMonth(): void {
    this.shiftCalendar(1);
  }

  protected nextYear(): void {
    this.shiftCalendar(12);
  }

  protected selectCalendarDay(day: CalendarDay): void {
    if (!day.date || day.isOutside) return;
    this.toggleBlockedCalendarDate(this.dateKey(day.date));
  }

  protected removeBlockedCalendarDate(key: string): void {
    this.blockedCalendarDates.update((dates) => {
      const next = new Set(dates);
      next.delete(key);
      return next;
    });
  }

  protected addMotif(): void {
    const categoryId = this.motifForm.categoryId || this.resolveMotifCategoryId();
    const durationMinutes = this.appointmentDuration();
    const price = Number(this.motifForm.price);
    const name = this.motifForm.name.trim();

    if (!categoryId) {
      this.feedback.info('Selectionnez une categorie avant d enregistrer ce service.');
      return;
    }
    if (!name || price <= 0) {
      this.feedback.info(
        'Renseignez un nom et un tarif valides.',
      );
      return;
    }

    this.isSaving.set(true);

    const request$ = this.doctorSpaceService.createService({
      categoryId,
      name,
      description: this.buildServiceDescription(name),
      price,
      priceType: this.defaultServicePriceType(),
      travelMode: this.selectedTravelMode(),
      durationMinutes,
      pauseMinutes: this.appointmentPause(),
      isRequired: this.motifForm.isRequired,
    });

    request$
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Motif ajoute.');
          this.resetMotifForm();
          this.refreshServices();
        },
        error: (error) =>
          this.feedback.error(
            getHttpErrorMessage(
              error,
              'Creation du motif impossible.',
            ),
          ),
      });
  }

  protected editMotif(motif: ConsultationMotif): void {
    this.editingMotifId.set(motif.id);
    this.editingMotif.set(motif);
    this.motifEditForm.categoryId = motif.categoryId;
    this.motifEditForm.name = motif.name;
    this.motifEditForm.durationMinutes = motif.durationMinutes;
    this.motifEditForm.price = motif.price;
    this.motifEditForm.isRequired = motif.isRequired;
    this.motifEditForm.travelMode = motif.travelMode;
  }

  protected closeMotifEditModal(): void {
    this.editingMotifId.set(null);
    this.editingMotif.set(null);
    this.resetMotifEditForm();
  }

  protected saveEditedMotif(): void {
    const editingMotifId = this.editingMotifId();
    const categoryId = this.motifEditForm.categoryId || this.resolveMotifCategoryId();
    const durationMinutes = this.appointmentDuration();
    const price = Number(this.motifEditForm.price);
    const name = this.motifEditForm.name.trim();

    if (!editingMotifId || !categoryId) {
      this.feedback.info('Selectionnez un service valide avant de modifier.');
      return;
    }
    if (!name || price <= 0) {
      this.feedback.info('Renseignez un nom et un tarif valides.');
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .updateService(editingMotifId, {
        name,
        description: this.buildServiceDescription(name),
        price,
        priceType: this.defaultServicePriceType(),
        travelMode: this.motifEditForm.travelMode,
        durationMinutes,
        pauseMinutes: this.appointmentPause(),
        isRequired: this.motifEditForm.isRequired,
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Motif mis a jour.');
          this.closeMotifEditModal();
          this.refreshServices();
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Mise a jour du motif impossible.')),
      });
  }

  protected resetMotifForm(): void {
    this.editingMotifId.set(null);
    this.editingMotif.set(null);
    this.motifForm.categoryId = '';
    this.motifForm.name = '';
    this.motifForm.durationMinutes = this.appointmentDuration();
    this.motifForm.price = this.selectedTravelMode() === 'TRANSPORT_COLIS' ? 500 : 10000;
    this.motifForm.isRequired = true;
  }

  private resetMotifEditForm(): void {
    this.motifEditForm.categoryId = '';
    this.motifEditForm.name = '';
    this.motifEditForm.durationMinutes = this.appointmentDuration();
    this.motifEditForm.price = this.selectedTravelMode() === 'TRANSPORT_COLIS' ? 500 : 10000;
    this.motifEditForm.isRequired = true;
    this.motifEditForm.travelMode = this.selectedTravelMode();
  }

  protected toggleMotifRequired(motif: ConsultationMotif): void {
    this.isSaving.set(true);
    this.doctorSpaceService
      .updateService(motif.id, { isRequired: !motif.isRequired })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => this.refreshServices(),
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Mise a jour impossible.')),
      });
  }

  protected deleteMotif(motif: ConsultationMotif): void {
    this.isSaving.set(true);
    this.doctorSpaceService
      .deleteService(motif.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Motif supprime.');
          this.refreshServices();
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Suppression du motif impossible.')),
      });
  }

  private loadSchedule(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.doctorSpaceService
      .getMyProfile()
      .pipe(
        catchError(() => of(null as BackendProfessionalProfile | null)),
        switchMap((profile) => {
          this.professionalProfile.set(profile);
          this.professionalProfileId.set(profile?.id ?? null);
          this.professionalName.set(profile?.utilisateur.nom ?? 'Mon espace professionnel');
          this.patchProfileForm(profile);
          if (!profile) {
            this.setActiveSection('profile');
          }

          return forkJoin({
            availabilities: profile
              ? this.doctorSpaceService
                  .listMyAvailabilities()
                  .pipe(catchError(() => of([] as BackendProfessionalAvailability[])))
              : of([] as BackendProfessionalAvailability[]),
            services: profile
              ? this.doctorSpaceService
                  .listMyServices()
                  .pipe(catchError(() => of([] as BackendProfessionalDetailService[])))
              : of([] as BackendProfessionalDetailService[]),
            categories: this.doctorSpaceService
              .listCategoryStructure()
              .pipe(catchError(() => of([] as CategoryStructure[]))),
            reservations: profile
              ? this.doctorSpaceService
                  .listMyReservations()
                  .pipe(catchError(() => of([] as BackendReservation[])))
              : of([] as BackendReservation[]),
            negotiations: profile && this.isProviderSpace()
              ? this.proposalService
                  .listMyPriceProposals('PRESTATAIRE')
                  .pipe(catchError(() => of([] as NegotiationView[])))
              : of([] as NegotiationView[]),
            wallet: profile
              ? this.doctorSpaceService
                  .getWallet()
                  .pipe(catchError(() => of(null as DoctorWalletView | null)))
              : of(null as DoctorWalletView | null),
            portfolio: profile?.statutKyc === 'VERIFIE'
              ? this.doctorSpaceService
                  .listPortfolio(profile.id)
                  .pipe(catchError(() => of([] as BackendProfessionalPortfolioItem[])))
              : of([] as BackendProfessionalPortfolioItem[]),
          });
        }),
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, "Impossible de charger l'espace prestataire."));
          return of({
            availabilities: [],
            services: [],
            categories: [],
            reservations: [],
            negotiations: [],
            wallet: null,
            portfolio: [],
          });
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe(({ availabilities, services, categories, reservations, negotiations, wallet, portfolio }) => {
        this.applyAvailabilities(availabilities);
        this.applyServices(services);
        this.categories.set(categories);
        this.reservations.set(reservations);
        this.syncAgendaCursorWithReservations(reservations);
        this.negotiations.set(negotiations);
        this.wallet.set(wallet);
        this.portfolioItems.set(portfolio);
        this.ensureActiveSectionIsAvailable();
        this.startNegotiationRealtime();
        this.startReservationRealtime();
        this.startProfessionalRealtimeFallback();
        if (this.activeSection() === 'wallet') {
          this.refreshWallet();
        }
      });
  }

  private ensureActiveSectionIsAvailable(): void {
    const section = this.activeSection();
    if (section !== 'profile' && !this.professionalProfileId()) {
      this.setActiveSection('profile');
      return;
    }

    if (section === 'consultation' && !this.showConsultationSection()) {
      this.setActiveSection(this.defaultSectionForSpace());
    }
  }

  private refreshAvailabilities(): void {
    const profileId = this.professionalProfileId();
    if (!profileId) {
      this.loadSchedule();
      return;
    }

    this.doctorSpaceService.listMyAvailabilities().subscribe({
      next: (availabilities) => this.applyAvailabilities(availabilities),
      error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Synchronisation impossible.')),
    });
  }

  private patchProfileForm(profile: BackendProfessionalProfile | null): void {
    this.profileForm.companyName = profile?.nomEntreprise ?? '';
    this.profileForm.city = profile?.ville ?? '';
    this.profileForm.bio = profile?.biographie ?? '';
    this.selectedVehicleType.set(profile?.typeVehicule ?? 'VOITURE');
    this.interventionAddress.set(profile?.ville ?? '');
    this.interventionCoordinate.set(
      typeof profile?.latitude === 'number' && typeof profile?.longitude === 'number'
        ? {
            latitude: profile.latitude,
            longitude: profile.longitude,
          }
        : null,
    );
  }

  private toLocalUploadPreview(file: File): UploadPreview {
    return {
      url: URL.createObjectURL(file),
      name: file.name,
      mimeType: file.type,
      isImage: file.type.startsWith('image/'),
      isLocal: true,
    };
  }

  private isValidProfessionalAsset(file: File, target: ProfessionalUploadTarget): boolean {
    const allowedTypes =
      target === 'portfolio'
        ? ['image/png', 'image/jpeg', 'image/webp']
        : ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    const maxSizeMb = target === 'portfolio' ? 5 : 8;

    if (!allowedTypes.includes(file.type)) {
      this.feedback.info(
        target === 'portfolio'
          ? 'Choisissez une image PNG, JPG ou WEBP pour le portfolio.'
          : 'Choisissez une image PNG, JPG, WEBP ou un PDF pour le KYC.',
      );
      return false;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      this.feedback.info(`Le fichier ne doit pas depasser ${maxSizeMb} Mo.`);
      return false;
    }

    return true;
  }

  private refreshServices(): void {
    const profileId = this.professionalProfileId();
    if (!profileId) return;

    this.doctorSpaceService.listMyServices().subscribe({
      next: (services) => this.applyServices(services),
      error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Synchronisation des motifs impossible.')),
    });
  }

  private refreshNegotiations(forceRefresh = false): void {
    if (!this.professionalProfileId() || !this.isProviderSpace()) return;

    this.proposalService.listMyPriceProposals('PRESTATAIRE', forceRefresh).subscribe({
      next: (negotiations) => this.negotiations.set(negotiations),
      error: (error) =>
        this.feedback.error(
          getHttpErrorMessage(error, 'Impossible de charger les négociations clients.'),
        ),
    });
  }

  private refreshReservations(showErrors = true): void {
    if (!this.professionalProfileId()) return;
    if (this.isReservationsRefreshInProgress) return;

    this.isReservationsRefreshInProgress = true;
    this.doctorSpaceService
      .listMyReservations()
      .pipe(
        finalize(() => {
          this.isReservationsRefreshInProgress = false;
        }),
      )
      .subscribe({
      next: (reservations) => {
        this.reservations.set(reservations);
        this.syncAgendaCursorWithReservations(reservations);
      },
      error: (error) => {
        if (showErrors) {
          this.feedback.error(
            getHttpErrorMessage(error, 'Impossible de charger les rendez-vous.'),
          );
        }
      },
    });
  }

  private startReservationRealtime(): void {
    if (!this.professionalProfileId() || this.reservationsRealtimeSubscription) {
      return;
    }

    this.reservationsRealtimeSubscription = this.reservationsRealtime
      .watchMyReservations('PRESTATAIRE')
      .subscribe((event) => {
        if (event.reservation) {
          this.upsertReservation(event.reservation);
        }
        this.refreshReservations();
      });
  }

  private startProfessionalRealtimeFallback(): void {
    if (!this.professionalProfileId() || this.professionalRealtimeFallbackSubscription) {
      return;
    }

    this.professionalRealtimeFallbackSubscription = timer(2500, 2500).subscribe(() => {
      const section = this.activeSection();
      if (section === 'patient-appointments' || section === 'negotiations' || section === 'agenda') {
        this.refreshReservations(false);
      }
    });
  }

  private startNegotiationRealtime(): void {
    if (!this.professionalProfileId() || !this.isProviderSpace() || this.negotiationsRealtimeSubscription) {
      return;
    }

    this.negotiationsRealtimeSubscription = this.negotiationsRealtime
      .watchMyNegotiations('PRESTATAIRE')
      .subscribe((event) => {
        if (event.negotiation) {
          this.upsertNegotiation(event.negotiation);
        }
        this.refreshNegotiations(true);
      });
  }

  private upsertNegotiation(negotiation: NegotiationView): void {
    this.negotiations.update((negotiations) => {
      const exists = negotiations.some((item) => item.id === negotiation.id);
      return exists
        ? negotiations.map((item) => (item.id === negotiation.id ? negotiation : item))
        : [negotiation, ...negotiations];
    });
  }

  private upsertReservation(reservation: BackendReservation): void {
    this.reservations.update((reservations) => {
      const exists = reservations.some((item) => item.id === reservation.id);
      const next = exists
        ? reservations.map((item) => (item.id === reservation.id ? reservation : item))
        : [reservation, ...reservations];
      this.syncAgendaCursorWithReservations(next);
      return next;
    });
  }

  private refreshWallet(): void {
    if (!this.professionalProfileId()) return;

    this.doctorSpaceService
      .getWallet()
      .pipe(catchError(() => of(null as DoctorWalletView | null)))
      .subscribe((wallet) => this.wallet.set(wallet));
  }

  private syncMotifDurationsWithAppointmentDuration(): void {
    const durationMinutes = this.appointmentDuration();
    const pauseMinutes = this.appointmentPause();
    const motifsToSync = this.motifs().filter(
      (motif) =>
        motif.durationMinutes !== durationMinutes ||
        motif.pauseMinutes !== pauseMinutes,
    );
    if (motifsToSync.length === 0) return;

    this.isSaving.set(true);
    forkJoin(
      motifsToSync.map((motif) =>
        this.doctorSpaceService.updateService(motif.id, { durationMinutes, pauseMinutes }),
      ),
    )
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.motifs.update((motifs) =>
            motifs.map((motif) => ({ ...motif, durationMinutes, pauseMinutes })),
          );
          this.feedback.success('Parametres des rendez-vous synchronises avec les motifs.');
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Synchronisation de la duree impossible.')),
      });
  }

  private mergeReservation(updated: BackendReservation): void {
    this.reservations.update((reservations) => {
      const exists = reservations.some((reservation) => reservation.id === updated.id);
      if (!exists) return [...reservations, updated];
      return reservations.map((reservation) => (reservation.id === updated.id ? updated : reservation));
    });
  }

  private syncAgendaCursorWithReservations(reservations: BackendReservation[]): void {
    if (reservations.length === 0) return;

    const currentWeekStart = this.startOfWeek(this.agendaCursor());
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    const datedReservations = reservations
      .map((reservation) => ({
        reservation,
        scheduledAt: new Date(reservation.dateHeure),
      }))
      .filter(({ scheduledAt }) => !Number.isNaN(scheduledAt.getTime()));

    const currentWeekHasReservation = datedReservations.some(
      ({ scheduledAt, reservation }) =>
        scheduledAt >= currentWeekStart &&
        scheduledAt <= currentWeekEnd &&
        this.matchesAgendaFilter(reservation.statut),
    );
    if (currentWeekHasReservation) return;

    const now = new Date();
    const target =
      datedReservations
        .filter(({ scheduledAt, reservation }) =>
          scheduledAt >= now && this.matchesAgendaFilter(reservation.statut),
        )
        .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())[0] ??
      datedReservations
        .filter(({ reservation }) => this.matchesAgendaFilter(reservation.statut))
        .sort((left, right) => right.scheduledAt.getTime() - left.scheduledAt.getTime())[0];

    if (target) {
      this.agendaCursor.set(this.startOfDay(target.scheduledAt));
    }
  }

  private buildAgendaRows(): string[] {
    const rows: string[] = [];
    const slotMinutes = this.appointmentStepMinutes();
    const { minMinutes, maxMinutes } = this.agendaTimeBounds();

    for (let minutes = minMinutes; minutes <= maxMinutes; minutes += slotMinutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      rows.push(`${hour}:${minute.toString().padStart(2, '0')}`);
    }

    const lastLabel = `${Math.floor(maxMinutes / 60)}:${(maxMinutes % 60).toString().padStart(2, '0')}`;
    if (rows[rows.length - 1] !== lastLabel) {
      rows.push(lastLabel);
    }

    return rows;
  }

  private agendaTimeBounds(): { minMinutes: number; maxMinutes: number } {
    const weekDays = this.agendaWeekDays();
    const startBoundary = this.parsePeriodBoundary(this.agendaPeriodStart(), false);
    const endBoundary = this.parsePeriodBoundary(this.agendaPeriodEnd(), true);
    let minMinutes = 7 * 60;
    let maxMinutes = 14 * 60;

    for (const reservation of this.reservations()) {
      const scheduledAt = new Date(reservation.dateHeure);
      if (Number.isNaN(scheduledAt.getTime())) continue;
      if (startBoundary && scheduledAt < startBoundary) continue;
      if (endBoundary && scheduledAt > endBoundary) continue;
      if (!this.matchesAgendaFilter(reservation.statut)) continue;
      if (!weekDays.some((day) => this.isSameDay(day.date, scheduledAt))) continue;

      const start = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
      const end = start + Math.max(30, reservation.dureeMinutes || reservation.service?.dureeMinutes || 30);
      minMinutes = Math.min(minMinutes, Math.max(0, Math.floor(start / 60) * 60));
      maxMinutes = Math.max(maxMinutes, Math.min(24 * 60, Math.ceil(end / 60) * 60));
    }

    return { minMinutes, maxMinutes };
  }

  private buildAgendaWeekDays(date: Date): AgendaDay[] {
    const monday = this.startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);
      return {
        date: current,
        dayLabel: ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'][index],
        dayNumber: current.getDate().toString().padStart(2, '0'),
      };
    });
  }

  private buildAgendaEvents(): AgendaEvent[] {
    const weekDays = this.agendaWeekDays();
    const services = new Map(this.motifs().map((motif) => [motif.id, motif]));
    const startBoundary = this.parsePeriodBoundary(this.agendaPeriodStart(), false);
    const endBoundary = this.parsePeriodBoundary(this.agendaPeriodEnd(), true);
    const { minMinutes, maxMinutes } = this.agendaTimeBounds();

    return this.reservations()
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        if (Number.isNaN(scheduledAt.getTime())) return null;
        if (startBoundary && scheduledAt < startBoundary) return null;
        if (endBoundary && scheduledAt > endBoundary) return null;
        if (!this.matchesAgendaFilter(reservation.statut)) return null;

        const dayIndex = weekDays.findIndex((day) => this.isSameDay(day.date, scheduledAt));
        if (dayIndex < 0) return null;

        const startMinutes = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
        if (startMinutes < minMinutes || startMinutes >= maxMinutes) return null;

        const localService = services.get(reservation.serviceId);
        const duration = Math.max(
          30,
          reservation.dureeMinutes ||
            reservation.service?.dureeMinutes ||
            localService?.durationMinutes ||
            30,
        );
        const slotMinutes = this.appointmentStepMinutes();
        const rowStart = 2 + Math.floor((startMinutes - minMinutes) / slotMinutes);
        const rowSpan = Math.max(1, Math.ceil((duration + this.appointmentPause()) / slotMinutes));
        const price =
          reservation.prixConvenu ??
          reservation.service?.prix ??
          localService?.price ??
          0;

        return {
          id: reservation.id,
          title: reservation.service?.nom ?? localService?.name ?? 'Consultation',
          timeLabel: `${this.formatAgendaTime(scheduledAt)} - ${this.formatAgendaTime(
            new Date(scheduledAt.getTime() + duration * 60 * 1000),
          )}`,
          clientLabel: this.clientLabel(reservation),
          price,
          status: reservation.statut,
          statusLabel: this.agendaReservationStatusLabel(reservation.statut),
          dayIndex,
          rowStart,
          rowSpan,
          variant: this.agendaEventVariant(reservation.statut),
        } satisfies AgendaEvent;
      })
      .filter((event): event is AgendaEvent => event !== null);
  }

  private buildMedicalHistoryRows(): MedicalHistoryRow[] {
    const now = Date.now();
    return this.reservations()
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        if (Number.isNaN(scheduledAt.getTime())) return null;
        if (this.isCancelledStatus(reservation.statut)) return null;

        const isFuture =
          scheduledAt.getTime() >= now &&
          reservation.statut !== 'TERMINEE' &&
          reservation.statut !== 'LITIGE';

        return {
          id: reservation.id,
          clientId: reservation.clientId,
          patientName: this.clientLabel(reservation),
          avatarUrl: reservation.client?.urlAvatar ?? null,
          serviceName: reservation.service?.nom ?? 'Consultation',
          scheduledAt,
          appointmentLabel: this.formatMedicalHistoryAppointment(scheduledAt),
          lastAppointmentLabel: this.lastAppointmentLabelForClient(
            reservation.clientId,
            reservation.id,
          ),
          isFuture,
          documents: this.medicalHistoryDocuments(reservation),
        } satisfies MedicalHistoryRow;
      })
      .filter((row): row is MedicalHistoryRow => row !== null)
      .sort((left, right) =>
        left.isFuture === right.isFuture
          ? left.isFuture
            ? left.scheduledAt.getTime() - right.scheduledAt.getTime()
            : right.scheduledAt.getTime() - left.scheduledAt.getTime()
          : left.isFuture
            ? -1
            : 1,
      );
  }

  private buildProviderHistoryRows(): ProviderAppointmentHistoryRow[] {
    return this.reservations()
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        if (Number.isNaN(scheduledAt.getTime())) return null;
        const clientName = this.clientLabel(reservation);
        return {
          id: reservation.id,
          clientName,
          avatarUrl: reservation.client?.urlAvatar ?? null,
          initials: this.initialsForName(clientName),
          serviceName: reservation.service?.nom ?? 'Service non renseigne',
          scheduledAt,
          timeLabel: this.formatAgendaTime(scheduledAt).replace(':', 'H'),
          dateLabel: new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
            .format(scheduledAt)
            .replace('.', ''),
          locationLabel: reservation.adresseClient || reservation.client?.adresse || 'Lieu non renseigne',
          amount: this.agendaReservationPrice(reservation),
          status: reservation.statut,
          statusLabel: this.providerHistoryStatusLabel(reservation.statut),
          statusTone: this.providerHistoryStatusTone(reservation.statut),
        } satisfies ProviderAppointmentHistoryRow;
      })
      .filter((row): row is ProviderAppointmentHistoryRow => row !== null)
      .sort((left, right) => right.scheduledAt.getTime() - left.scheduledAt.getTime());
  }

  private buildPatientMedicalDetail(
    row: MedicalHistoryRow,
    reservation: BackendReservation,
    profile: PatientMedicalProfile,
  ): PatientMedicalDetail {
    return {
      ...row,
      reservation,
      profile,
      ageLabel: 'Non renseigne',
      genderLabel: 'Non renseigne',
      locationLabel: reservation.client?.adresse || reservation.adresseClient || 'Non renseigne',
      phoneLabel: reservation.client?.numeroTelephone || 'Non renseigne',
      alerts: [...profile.allergies, ...profile.conditions],
      medicalActs: this.patientMedicalActs(row.clientId),
      availableSpecialties: this.medicalSpecialtyChips(),
    };
  }

  private patientMedicalActs(clientId: string): PatientMedicalDetail['medicalActs'] {
    return this.reservations()
      .filter((reservation) => reservation.clientId === clientId)
      .filter((reservation) => !this.isCancelledStatus(reservation.statut))
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        return {
          id: reservation.id,
          title: reservation.service?.nom ?? 'Consultation',
          category: reservation.service?.categorie?.nom ?? 'Acte medical',
          dateLabel: Number.isNaN(scheduledAt.getTime())
            ? 'Date non renseignee'
            : this.formatMedicalHistoryDate(scheduledAt),
        };
      })
      .sort((left, right) => {
        const leftDate = new Date(
          this.reservations().find((reservation) => reservation.id === left.id)?.dateHeure ?? 0,
        ).getTime();
        const rightDate = new Date(
          this.reservations().find((reservation) => reservation.id === right.id)?.dateHeure ?? 0,
        ).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 6);
  }

  private medicalSpecialtyChips(): MedicalSpecialtyChip[] {
    const tones: MedicalSpecialtyChip['tone'][] = [
      'red',
      'blue',
      'purple',
      'amber',
      'green',
      'gray',
      'mint',
      'pink',
    ];

    return this.categories()
      .slice(0, 20)
      .map((category, index) => ({
        label: category.nom,
        tone: tones[index % tones.length],
      }));
  }

  private medicalHistoryDocuments(reservation: BackendReservation): MedicalHistoryDocument[] {
    const notes = reservation.notes?.trim();
    if (!notes) return [];
    return [{ label: 'Notes du rendez-vous', type: 'DOC' }];
  }

  private lastAppointmentLabelForClient(clientId: string, excludedReservationId: string): string {
    const pastReservation = this.reservations()
      .filter((reservation) => reservation.clientId === clientId)
      .filter((reservation) => reservation.id !== excludedReservationId)
      .filter((reservation) => !this.isCancelledStatus(reservation.statut))
      .map((reservation) => new Date(reservation.dateHeure))
      .filter((date) => !Number.isNaN(date.getTime()))
      .filter((date) => date.getTime() < Date.now())
      .sort((left, right) => right.getTime() - left.getTime())[0];

    return pastReservation ? this.formatMedicalHistoryDate(pastReservation) : 'Aucun rendez-vous passe';
  }

  private formatMedicalHistoryAppointment(date: Date): string {
    const datePart = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
      .format(date)
      .replace('.', '');
    return `${datePart} — ${this.formatAgendaTime(date)}`;
  }

  private formatMedicalHistoryDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private sumPeriodRevenue(predicate: (status: AppointmentStatus) => boolean): number {
    const { start, end } = this.agendaStatPeriod();
    return this.reservations().reduce((total, reservation) => {
      const scheduledAt = new Date(reservation.dateHeure);
      if (
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt < start ||
        scheduledAt > end ||
        !predicate(reservation.statut)
      ) {
        return total;
      }

      const service = this.motifs().find((motif) => motif.id === reservation.serviceId);
      return total + Number(reservation.prixConvenu ?? reservation.service?.prix ?? service?.price ?? 0);
    }, 0);
  }

  private agendaStatPeriod(): { start: Date; end: Date } {
    const cursor = this.agendaCursor();
    if (this.agendaViewMode() === 'day') {
      const start = this.startOfDay(cursor);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (this.agendaViewMode() === 'week') {
      const start = this.startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const start = this.startOfMonth(cursor);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private buildNextAgendaReservationView(): NextAgendaReservationView | null {
    const now = new Date();
    const nextReservation = this.reservations()
      .map((reservation) => ({
        reservation,
        scheduledAt: new Date(reservation.dateHeure),
      }))
      .filter(({ reservation, scheduledAt }) => {
        return (
          !Number.isNaN(scheduledAt.getTime()) &&
          scheduledAt.getTime() > now.getTime() &&
          this.isAgendaUpcomingStatus(reservation.statut)
        );
      })
      .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())[0];

    if (!nextReservation) return null;

    const { reservation, scheduledAt } = nextReservation;
    const patientName = this.clientLabel(reservation);
    const minutes = Math.max(1, Math.round((scheduledAt.getTime() - now.getTime()) / 60000));

    return {
      reservation,
      patientName,
      avatarUrl: reservation.client?.urlAvatar ?? null,
      initials: this.initialsForName(patientName),
      serviceName: reservation.service?.nom ?? 'Consultation',
      locationLabel: reservation.adresseClient || reservation.client?.adresse || 'Adresse non renseignee',
      timeLabel: this.formatAgendaTime(scheduledAt).replace(':', 'H'),
      dayLabel: scheduledAt.getDate().toString().padStart(2, '0'),
      monthLabel: new Intl.DateTimeFormat('fr-FR', { month: 'short' })
        .format(scheduledAt)
        .replace('.', '')
        .toUpperCase(),
      durationLabel: this.formatDelayLabel(Math.max(1, reservation.dureeMinutes || 0)),
      delayLabel: this.formatDelayLabel(minutes),
      progress: Math.max(8, Math.min(100, 100 - (minutes / (24 * 60)) * 100)),
      statusLabel: this.agendaReservationStatusLabel(reservation.statut),
      confirmationLabel:
        this.isAgendaUpcomingStatus(reservation.statut)
          ? 'LE RDV EST CONFIRME'
          : this.agendaReservationStatusLabel(reservation.statut).toUpperCase(),
    };
  }

  private formatDelayLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h${rest.toString().padStart(2, '0')}` : `${hours}h`;
  }

  private matchesAgendaFilter(status: AppointmentStatus): boolean {
    const filter = this.agendaFilter();
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return this.isAgendaActiveStatus(status);
    if (filter === 'DONE') return status === 'TERMINEE';
    if (filter === 'CANCELLED') return this.isCancelledStatus(status);
    return status === 'LITIGE';
  }

  protected isCancelledStatus(status: AppointmentStatus): boolean {
    return status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private isAgendaActiveStatus(status: AppointmentStatus): boolean {
    return (
      status === 'CONFIRMEE' ||
      status === 'PAYEE_SEQUESTRE' ||
      status === 'EN_COURS'
    );
  }

  private isAgendaRevenueStatus(status: AppointmentStatus): boolean {
    return (
      status === 'CONFIRMEE' ||
      status === 'PAYEE_SEQUESTRE' ||
      status === 'EN_COURS' ||
      status === 'TERMINEE'
    );
  }

  private isAgendaUpcomingStatus(status: AppointmentStatus): boolean {
    return status === 'CONFIRMEE' || status === 'PAYEE_SEQUESTRE' || status === 'EN_COURS';
  }

  private agendaEventVariant(status: AppointmentStatus): AgendaEvent['variant'] {
    const variants: Record<AppointmentStatus, AgendaEvent['variant']> = {
      CONFIRMEE: 'confirmed',
      PAYEE_SEQUESTRE: 'paid',
      EN_COURS: 'active',
      TERMINEE: 'done',
      ANNULEE: 'cancelled',
      NO_SHOW: 'absent',
      LITIGE: 'dispute',
    };
    return variants[status];
  }

  private isMoreThanHoursBefore(value: string, hours: number): boolean {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() - Date.now() > hours * 60 * 60 * 1000;
  }

  protected clientLabel(reservation: BackendReservation): string {
    return reservation.client?.nom || `Client ${reservation.clientId.slice(0, 6).toUpperCase()}`;
  }

  protected providerHistoryFilterCount(filter: ProviderHistoryFilter): number {
    if (filter === 'ALL') return this.providerHistoryMonthRows().length;
    return this.providerHistoryMonthRows().filter((row) => row.status === filter).length;
  }

  private resetProviderHistoryPagination(): void {
    this.providerHistoryPage.set(1);
  }

  private providerHistoryStatusLabel(status: AppointmentStatus): string {
    if (status === 'TERMINEE') return 'Terminé';
    if (status === 'ANNULEE') return 'Annulé';
    if (status === 'NO_SHOW') return 'Absent';
    return this.agendaReservationStatusLabel(status);
  }

  private providerHistoryStatusTone(status: AppointmentStatus): ProviderAppointmentHistoryRow['statusTone'] {
    if (status === 'TERMINEE') return 'done';
    if (status === 'ANNULEE') return 'cancelled';
    if (status === 'NO_SHOW') return 'absent';
    return 'pending';
  }

  private sumProviderRows(rows: ProviderAppointmentHistoryRow[]): number {
    return rows.reduce((total, row) => total + row.amount, 0);
  }

  private initialsForName(name: string): string {
    return userInitials(name, 'CL');
  }

  private monthInputValue(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  private dateInputValue(date: Date): string {
    return `${this.monthInputValue(date)}-${date.getDate().toString().padStart(2, '0')}`;
  }

  private negotiationDate(negotiation: NegotiationView): Date {
    const date = new Date(negotiation.dateHeureProposee || negotiation.creeLe);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private parseMonthValue(value: string): Date | null {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1);
  }

  private formatProviderHistoryMonth(date: Date): string {
    const label = new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return label.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }

  private shiftAgendaPeriod(direction: -1 | 1): void {
    const next = new Date(this.agendaCursor());
    switch (this.agendaViewMode()) {
      case 'day':
        next.setDate(next.getDate() + direction);
        break;
      case 'week':
        next.setDate(next.getDate() + direction * 7);
        break;
      case 'month':
        next.setMonth(next.getMonth() + direction);
        break;
    }
    this.agendaCursor.set(this.startOfDay(next));
  }

  private startOfWeek(date: Date): Date {
    const current = this.startOfDay(date);
    const mondayOffset = (current.getDay() + 6) % 7;
    current.setDate(current.getDate() - mondayOffset);
    return current;
  }

  private parsePeriodBoundary(value: string, endOfDay: boolean): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay) date.setHours(23, 59, 59, 999);
    return date;
  }

  protected formatAgendaTime(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  private applyServices(services: BackendProfessionalDetailService[]): void {
    const activeServices = services.filter((service) => service.estDisponible);
    const firstTravelMode = activeServices.find((service) => service.modeDeplacement)?.modeDeplacement;
    if (firstTravelMode) {
      this.selectedTravelMode.set(this.normalizeTravelModeForSpace(firstTravelMode));
    }

    const firstDuration = activeServices.find((service) => Number(service.dureeMinutes) > 0)?.dureeMinutes;
    if (firstDuration) {
      this.appointmentDuration.set(this.normalizeMinutes(firstDuration, 0, 90));
      this.motifForm.durationMinutes = this.appointmentDuration();
    }
    const firstPause = activeServices.find((service) => Number(service.pauseMinutes) >= 0)?.pauseMinutes;
    if (typeof firstPause === 'number') {
      this.appointmentPause.set(this.normalizeMinutes(firstPause, 0, 60));
    }

    this.motifs.set(
      activeServices.map((service) => ({
          id: service.id,
          categoryId: service.categorieId,
          name: service.nom,
          description: service.description,
          durationMinutes: service.dureeMinutes ?? 15,
          pauseMinutes: service.pauseMinutes ?? 0,
          price: Number(service.prix),
          isRequired: service.estObligatoire ?? false,
          travelMode: this.normalizeTravelModeForSpace(
            service.modeDeplacement ?? 'PRESTATAIRE_SE_DEPLACE',
          ),
        })),
    );
  }

  private normalizeTravelModeForSpace(mode: ServiceTravelMode): ServiceTravelMode {
    return !this.isProviderSpace() && mode === 'TRANSPORT_COLIS'
      ? 'PRESTATAIRE_SE_DEPLACE'
      : mode;
  }

  private resolveMotifCategoryId(): string | null {
    const existingCategoryId = this.motifs()[0]?.categoryId;
    if (existingCategoryId) return existingCategoryId;

    return (
      this.categories().find((category) =>
        category.nom
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes('sante'),
      )?.id ??
      this.categories().find((category) =>
        category.nom
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes('medec'),
      )?.id ??
      this.categories().find((category) => category.estActive !== false)?.id ??
      null
    );
  }

  private buildServiceDescription(name: string): string {
    return this.isProviderSpace()
      ? `Service professionnel: ${name}`
      : `Motif de consultation: ${name}`;
  }

  private disableDay(day: DaySchedule): void {
    const ids = day.slots.map((slot) => slot.id).filter((id): id is string => !!id);
    if (ids.length === 0) {
      this.applyDaySlots(day.dayOfWeek, []);
      return;
    }

    this.isSaving.set(true);
    forkJoin(ids.map((id) => this.doctorSpaceService.deleteAvailability(id)))
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.applyDaySlots(day.dayOfWeek, []);
          this.feedback.success(`${day.label} est maintenant indisponible.`);
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Desactivation impossible.'));
          this.refreshAvailabilities();
        },
      });
  }

  private createDefaultSlots(dayOfWeek: number): void {
    this.isSaving.set(true);
    forkJoin([
      this.doctorSpaceService.createAvailability({ dayOfWeek, startTime: '09:00', endTime: '12:00' }),
      this.doctorSpaceService.createAvailability({ dayOfWeek, startTime: '14:00', endTime: '17:00' }),
    ])
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Disponibilites activees.');
          this.refreshAvailabilities();
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Activation impossible.')),
      });
  }

  private createSlot(dayOfWeek: number, startTime: string, endTime: string): void {
    this.isSaving.set(true);
    this.doctorSpaceService
      .createAvailability({ dayOfWeek, startTime, endTime })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Nouvelle disponibilite ajoutee.');
          this.refreshAvailabilities();
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Creation impossible.')),
      });
  }

  private applyAvailabilities(availabilities: BackendProfessionalAvailability[]): void {
    const nextDays = this.buildEmptyWeek();
    for (const availability of availabilities.filter((item) => item.estActive)) {
      const day = nextDays.find((item) => item.dayOfWeek === availability.jourSemaine);
      if (!day) continue;
      day.enabled = true;
      day.slots.push({
        id: availability.id,
        startTime: this.formatTime(availability.heureDebut),
        endTime: this.formatTime(availability.heureFin),
      });
    }

    for (const day of nextDays) {
      day.slots.sort((left, right) => left.startTime.localeCompare(right.startTime));
      day.enabled = day.slots.length > 0;
    }

    this.days.set(nextDays);
    this.updateAppointmentSettings(nextDays);
  }

  private applyDaySlots(dayOfWeek: number, slots: AvailabilitySlot[]): void {
    this.days.update((days) =>
      days.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? { ...day, enabled: slots.length > 0, slots }
          : day,
      ),
    );
  }

  private updateAppointmentSettings(days: DaySchedule[]): void {
    const firstServiceDuration = this.motifs().find((motif) => motif.durationMinutes > 0)?.durationMinutes;
    if (firstServiceDuration) {
      this.appointmentDuration.set(this.normalizeMinutes(firstServiceDuration, 0, 90));
    }
    const firstServicePause = this.motifs().find((motif) => motif.pauseMinutes >= 0)?.pauseMinutes;
    if (typeof firstServicePause === 'number') {
      this.appointmentPause.set(this.normalizeMinutes(firstServicePause, 0, 60));
    }
    this.motifForm.durationMinutes = this.appointmentDuration();
  }

  private buildEmptyWeek(): DaySchedule[] {
    return [
      { dayOfWeek: 1, label: 'Lundi', enabled: false, slots: [] },
      { dayOfWeek: 2, label: 'Mardi', enabled: false, slots: [] },
      { dayOfWeek: 3, label: 'Mercredi', enabled: false, slots: [] },
      { dayOfWeek: 4, label: 'Jeudi', enabled: false, slots: [] },
      { dayOfWeek: 5, label: 'Vendredi', enabled: false, slots: [] },
      { dayOfWeek: 6, label: 'Samedi', enabled: false, slots: [] },
      { dayOfWeek: 0, label: 'Dimanche', enabled: false, slots: [] },
    ];
  }

  private buildCalendarDays(date: Date, days: DaySchedule[], selectedDateKeys: ReadonlySet<string>): CalendarDay[] {
    const today = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const firstWeekDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const enabledDays = new Set(days.filter((day) => day.enabled).map((day) => day.dayOfWeek));
    const cells: CalendarDay[] = [];

    for (let i = 0; i < firstWeekDay; i += 1) {
      cells.push({
        dayOfMonth: 0,
        date: null,
        isToday: false,
        isSelected: false,
        isOutside: true,
        isWorkingDay: false,
        isBlocked: false,
      });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = new Date(year, month, day);
      const dayOfWeek = cellDate.getDay();
      const isWorkingDay = enabledDays.has(dayOfWeek);
      cells.push({
        dayOfMonth: day,
        isToday:
          day === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
        isSelected: selectedDateKeys.has(this.dateKey(cellDate)),
        date: cellDate,
        isWorkingDay,
        isBlocked: !isWorkingDay,
        isOutside: false,
      });
    }
    while (cells.length < 35) {
      cells.push({
        dayOfMonth: 0,
        date: null,
        isToday: false,
        isSelected: false,
        isOutside: true,
        isWorkingDay: false,
        isBlocked: false,
      });
    }
    return cells.slice(0, 35);
  }

  private shiftCalendar(monthDelta: number): void {
    const current = this.calendarCursor();
    const next = new Date(current.getFullYear(), current.getMonth() + monthDelta, 1);
    this.calendarCursor.set(next);
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toggleBlockedCalendarDate(key: string): void {
    this.blockedCalendarDates.update((dates) => {
      const next = new Set(dates);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatBlockedCalendarDate(key: string): string {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private progressPercent(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  }

  private getNextSlot(slots: AvailabilitySlot[]): { startTime: string; endTime: string } {
    if (slots.length === 0) return { startTime: '09:00', endTime: '12:00' };
    if (slots.length === 1) return { startTime: '14:00', endTime: '17:00' };
    return { startTime: '17:00', endTime: '18:00' };
  }

  private isValidSlot(slot: AvailabilitySlot): boolean {
    return /^\d{2}:\d{2}$/.test(slot.startTime) && /^\d{2}:\d{2}$/.test(slot.endTime) && slot.startTime < slot.endTime;
  }

  private formatTime(value: string): string {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCHours().toString().padStart(2, '0')}:${date
        .getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
    }
    return value.slice(0, 5);
  }

  private minutesBetween(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    return endHour * 60 + endMinute - (startHour * 60 + startMinute);
  }

  private buildAppointmentSlotPreviews(slot: AvailabilitySlot): AppointmentSlotPreview[] {
    if (!this.isValidSlot(slot)) return [];

    const duration = this.appointmentDuration();
    const pause = this.appointmentPause();
    const step = duration + pause;
    if (duration <= 0 || step <= 0) return [];

    const start = this.timeToMinutes(slot.startTime);
    const end = this.timeToMinutes(slot.endTime);
    const previews: AppointmentSlotPreview[] = [];

    for (let cursor = start; cursor + duration <= end; cursor += step) {
      previews.push({
        startTime: this.minutesToTime(cursor),
        endTime: this.minutesToTime(cursor + duration),
      });
    }

    return previews;
  }

  private availabilityPreviewKey(day: AvailabilityPreviewDay, preview: AppointmentSlotPreview): string {
    return `${day.key}-${preview.startTime}-${preview.endTime}`;
  }

  private buildAvailabilityPreviewDays(): AvailabilityPreviewDay[] {
    const days = this.days();
    const today = this.startOfDay(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const schedule = days.find((day) => day.dayOfWeek === date.getDay());
      return {
        key: this.dateKey(date),
        label: this.formatAvailabilityPreviewDate(date),
        previews: schedule ? this.dayAppointmentPreviews(schedule) : [],
      };
    });
  }

  private formatAvailabilityPreviewDate(date: Date): string {
    const value = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
    }).format(date);
    return value
      .replace('.', '')
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }

  private normalizeMinutes(value: string | number, min: number, max: number): number {
    const numeric = Math.trunc(Number(value));
    if (!Number.isFinite(numeric)) return min;
    const clamped = Math.max(min, Math.min(max, numeric));
    return Math.round(clamped / 5) * 5;
  }

  private timeToMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private minutesToTime(value: number): string {
    const normalized = ((value % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private toAvailability(
    dayOfWeek: number,
    id: string,
    startTime: string,
    endTime: string,
  ): BackendProfessionalAvailability {
    return {
      id,
      jourSemaine: dayOfWeek,
      heureDebut: startTime,
      heureFin: endTime,
      estActive: true,
    };
  }
}

