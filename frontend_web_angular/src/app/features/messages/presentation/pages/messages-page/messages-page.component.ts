import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { publicAssetUrl } from '../../../../../shared/utils/public-asset-url';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../../appointments/data-access/appointments.service';
import { AppointmentView } from '../../../../appointments/domain/appointments.models';
import {
  NegotiationView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';
import { MessageComposerComponent } from '../../components/message-composer/message-composer.component';
import { MessagesService } from '../../../data-access/messages.service';
import { MessagesRealtimeService } from '../../../data-access/messages-realtime.service';
import { Conversation, ConversationMessage } from '../../../domain/models/messages.models';

interface PendingProposal {
  negotiationId: string | null;
  conversationId: string | null;
  professionalId: string | null;
  providerName: string;
  serviceName: string;
  amount: number;
  status: string | null;
  reservationId: string | null;
  appointmentDate: string | null;
  address: string | null;
  durationMinutes: number;
  proposalMessage: string | null;
}

interface ReservationPaymentDraft {
  negotiationId: string;
  appointmentDate: string;
  address: string;
  durationMinutes: number;
}

type ConversationFilter = 'ALL' | 'UNREAD' | 'FAVORITES';

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppNavbarComponent, MessageComposerComponent],
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss',
})
export class MessagesPageComponent implements OnInit, OnDestroy {
  @ViewChild('messageThread') private messageThread?: ElementRef<HTMLElement>;

  private readonly messagesService = inject(MessagesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly authSession = inject(AuthSessionService);
  private readonly messagesRealtime = inject(MessagesRealtimeService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly messages = signal<ConversationMessage[]>([]);
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly draft = signal('');
  protected readonly conversationFilter = signal<ConversationFilter>('ALL');
  protected readonly favoriteConversationIds = signal<Set<string>>(new Set());
  protected readonly isLoadingConversations = signal(true);
  protected readonly isLoadingMessages = signal(false);
  protected readonly isSending = signal(false);
  protected readonly isUploadingMedia = signal(false);
  protected readonly isRecordingVoice = signal(false);
  protected readonly selectedAttachmentName = signal<string | null>(null);
  protected readonly pendingMediaUrl = signal<string | null>(null);
  protected readonly pendingMediaKind = signal<'image' | 'file' | 'audio' | null>(null);
  protected readonly pendingVoiceDurationSeconds = signal(0);
  protected readonly voiceRecordingSeconds = signal(0);
  protected readonly voiceLevel = signal(0);
  protected readonly isPreparingPayment = signal(false);
  protected readonly isUpdatingProposal = signal(false);
  protected readonly isCancellingAcceptedProposal = signal(false);
  protected readonly isLoadingAppointmentPreview = signal(false);
  protected readonly isCounterOfferOpen = signal(false);
  protected readonly counterOfferAmount = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pendingProposal = signal<PendingProposal | null>(null);
  protected readonly priceProposals = signal<NegotiationView[]>([]);
  protected readonly appointmentPreview = signal<AppointmentView | null>(null);
  protected readonly failedAvatarUrls = signal<Set<string>>(new Set());
  private readonly requestedConversationId = signal<string | null>(null);
  private readonly requestedReservationId = signal<string | null>(null);
  private readonly requestedNegotiationId = signal<string | null>(null);
  private readonly requestedDirectProfessionalId = signal<string | null>(null);
  private readonly requestedDirectProfessionalUserId = signal<string | null>(null);
  private readonly messagesPageSize = 100;
  private readonly messagesByConversation = new Map<string, ConversationMessage[]>();
  private activeMessagesRequestId = 0;
  private pendingThreadScrollId: ReturnType<typeof setTimeout> | null = null;
  private proposalStatusRefreshId: ReturnType<typeof setInterval> | null = null;
  private realtimeMessageSubscription: Subscription | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private voiceChunks: Blob[] = [];
  private voiceRecordingTimer: ReturnType<typeof setInterval> | null = null;
  private voiceAudioContext: AudioContext | null = null;
  private voiceAnalyser: AnalyserNode | null = null;
  private voiceLevelFrame: number | null = null;

  protected readonly selectedConversation = computed(() =>
    this.conversations().find((conversation) => conversation.id === this.selectedConversationId()) ?? null,
  );

  protected readonly paidAppointmentPreview = computed(() => {
    const appointment = this.appointmentPreview();
    return appointment && this.isPaidAppointmentStatus(appointment.status) ? appointment : null;
  });

  protected readonly filteredConversations = computed(() => {
    const query = this.search().trim().toLowerCase();
    const filter = this.conversationFilter();

    return this.conversations().filter((conversation) => {
      const lastMessage = conversation.lastMessage?.content ?? '';
      const matchesSearch = !query || (
        conversation.counterpart.name.toLowerCase().includes(query) ||
        lastMessage.toLowerCase().includes(query)
      );

      if (!matchesSearch) {
        return false;
      }

      if (filter === 'UNREAD') {
        return conversation.unreadCount > 0;
      }

      if (filter === 'FAVORITES') {
        return this.favoriteConversationIds().has(conversation.id);
      }

      return true;
    });
  });

  protected readonly visibleProposal = computed<PendingProposal | null>(() => {
    const proposal = this.pendingProposal();
    const conversation = this.selectedConversation();
    const conversationProposal = conversation ? this.proposalFromConversation(conversation) : null;

    if (conversationProposal) {
      return proposal && this.isProposalForConversation(proposal, conversation)
        ? {
            ...conversationProposal,
            appointmentDate: proposal.appointmentDate,
            address: proposal.address,
            durationMinutes: proposal.durationMinutes,
            serviceName: proposal.serviceName || conversationProposal.serviceName,
            proposalMessage: proposal.proposalMessage || conversationProposal.proposalMessage,
          }
        : conversationProposal;
    }

    if (proposal && this.isProposalForConversation(proposal, conversation)) {
      return proposal;
    }

    if (!conversation) {
      return proposal;
    }

    return this.proposalFromConversation(conversation);
  });

  protected readonly visibleProposalStep = computed<PendingProposal | null>(() => {
    const proposal = this.visibleProposal();
    if (
      this.paidAppointmentPreview() ||
      this.isPaidConversationStatus(proposal?.status) ||
      (Boolean(proposal?.reservationId) && this.isLoadingAppointmentPreview())
    ) {
      return null;
    }

    return proposal;
  });

  protected readonly isProposalAccepted = computed(() => {
    const status = this.visibleProposalStep()?.status;
    return status === 'ACCEPTEE' || status === 'CONVERTIE_EN_RESERVATION';
  });

  protected readonly canRespondToProposal = computed(() => {
    const proposal = this.visibleProposalStep();
    return (
      this.isProfessionalRole() &&
      proposal?.status === 'EN_ATTENTE_PRESTATAIRE' &&
      Boolean(proposal.negotiationId)
    );
  });
  protected readonly canShowNegotiationButton = computed(() => {
    const proposal = this.visibleProposalStep();
    return (
      this.currentUser()?.role === 'CLIENT' &&
      Boolean(proposal?.negotiationId) &&
      (proposal?.status === 'EN_ATTENTE_CLIENT' ||
        proposal?.status === 'EN_ATTENTE_PRESTATAIRE')
    );
  });

  protected readonly canPayAcceptedProposal = computed(
    () => this.currentUser()?.role === 'CLIENT' && this.isProposalAccepted(),
  );

  protected readonly counterOfferAmountLabel = computed(() =>
    this.formatAmount(this.counterOfferAmount() ?? this.visibleProposalStep()?.amount ?? 0),
  );

  protected readonly acceptedPaymentActionLabel = computed(() => {
    if (this.isPreparingPayment()) {
      return 'Preparation...';
    }

    return this.visibleProposalStep()?.reservationId ? 'Payez maintenant' : 'Preparer le paiement';
  });

  protected readonly acceptedCancelActionLabel = computed(() => {
    if (this.isCancellingAcceptedProposal()) {
      return 'Annulation...';
    }

    return this.visibleProposalStep()?.reservationId ? 'Annuler la reservation' : "Annuler l'offre";
  });

  ngOnInit(): void {
    this.readPendingProposalFromQuery();
    this.startRealtimeMessaging();
    this.startProposalRefresh();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    if (this.proposalStatusRefreshId) {
      clearInterval(this.proposalStatusRefreshId);
    }
    this.clearVoiceRecordingTimer();
    this.stopVoiceLevelMeter();
    if (this.pendingThreadScrollId) {
      clearTimeout(this.pendingThreadScrollId);
    }
    this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
    this.realtimeMessageSubscription?.unsubscribe();
    this.messagesRealtime.disconnect();
  }

  protected selectConversation(conversationId: string): void {
    if (this.selectedConversationId() === conversationId) {
      return;
    }

    this.selectedConversationId.set(conversationId);
    this.messages.set(this.messagesByConversation.get(conversationId) ?? []);
    this.scrollThreadToBottom();
    this.markConversationAsReadLocally(conversationId);
    this.messagesRealtime.joinConversation(conversationId);
    this.appointmentPreview.set(null);
    this.loadMessages(conversationId);
    setTimeout(() => this.loadAppointmentPreviewForVisibleProposal(), 0);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected updateSearchFromEvent(event: Event): void {
    this.updateSearch((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected selectConversationFilter(filter: ConversationFilter): void {
    this.conversationFilter.set(filter);
  }

  protected toggleConversationFavorite(event: Event, conversationId: string): void {
    event.stopPropagation();
    this.favoriteConversationIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }

  protected isFavoriteConversation(conversationId: string): boolean {
    return this.favoriteConversationIds().has(conversationId);
  }

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected sendMessage(): void {
    this.sendMessageWithMedia(this.pendingMediaUrl() ?? undefined);
  }

  protected sendMessageWithMedia(mediaUrl?: string, fallbackContent = ''): void {
    const conversation = this.selectedConversation();
    const content = this.draft().trim() || fallbackContent;

    if (!conversation || (!content && !mediaUrl) || this.isSending()) {
      return;
    }

    this.isSending.set(true);
    this.messagesService.sendMessage(conversation.id, content, mediaUrl).subscribe({
      next: (message) => {
        this.upsertMessage(message);
        this.draft.set('');
        this.clearPendingMedia();
        this.isSending.set(false);
        this.refreshConversationsSilently();
      },
      error: () => {
        const message = "Impossible d'envoyer le message pour le moment.";
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isSending.set(false);
      },
    });
  }

  protected selectImage(event: Event): void {
    this.handleMediaInput(event, 'image');
  }

  protected selectAttachment(event: Event): void {
    this.handleMediaInput(event, 'file');
  }

  protected isOwnMessage(message: ConversationMessage): boolean {
    return this.isCurrentUserId(message.senderId) || this.isCurrentUserId(message.sender?.id);
  }

  protected initials(name: string): string {
    return userInitials(name);
  }

  protected visibleAvatarUrl(url: string | null | undefined): string | null {
    const normalizedUrl = publicAssetUrl(url);
    if (!normalizedUrl || this.failedAvatarUrls().has(normalizedUrl)) {
      return null;
    }

    return normalizedUrl;
  }

  protected handleAvatarError(url: string | null | undefined): void {
    const normalizedUrl = publicAssetUrl(url);
    if (!normalizedUrl) {
      return;
    }

    this.failedAvatarUrls.update((urls) => {
      const next = new Set(urls);
      next.add(normalizedUrl);
      return next;
    });
  }

  protected conversationPreview(conversation: Conversation): string {
    if (conversation.lastMessage?.content) {
      return conversation.lastMessage.content;
    }

    if (conversation.lastMessage?.mediaUrl) {
      if (this.isAudioMedia(conversation.lastMessage.mediaUrl)) return 'Message vocal';
      if (this.isImageMedia(conversation.lastMessage.mediaUrl)) return 'Image';
      return 'Piece jointe';
    }

    return 'Conversation ouverte';
  }

  protected isImageMedia(url: string | null | undefined): boolean {
    return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url ?? '');
  }

  protected isAudioMedia(url: string | null | undefined): boolean {
    return /\.(webm|mp3|m4a|wav|ogg)(\?|#|$)/i.test(url ?? '');
  }

  protected mediaDisplayUrl(url: string | null | undefined): string {
    return publicAssetUrl(url) ?? url ?? '';
  }

  protected mediaFileName(url: string | null | undefined): string {
    if (!url) {
      return 'Piece jointe';
    }

    const cleanUrl = url.split('?')[0].split('#')[0];
    return decodeURIComponent(cleanUrl.split('/').pop() || 'Piece jointe');
  }

  protected pendingMediaLabel(): string {
    const kind = this.pendingMediaKind();
    if (kind === 'audio') {
      return `Message vocal - ${this.formatDuration(this.pendingVoiceDurationSeconds())}`;
    }

    if (kind === 'image') {
      return this.selectedAttachmentName() || 'Image prete a envoyer';
    }

    return this.selectedAttachmentName() || 'Piece jointe prete a envoyer';
  }

  protected openMedia(mediaUrl: string): void {
    this.messagesService.downloadMedia(mediaUrl).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      },
      error: () => {
        this.feedback.error('Impossible de recuperer ce document pour le moment.');
      },
    });
  }

  protected formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  protected clearPendingMedia(): void {
    this.pendingMediaUrl.set(null);
    this.pendingMediaKind.set(null);
    this.selectedAttachmentName.set(null);
    this.pendingVoiceDurationSeconds.set(0);
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected formatTime(value: string | null): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
      .format(value || 0)
      .replace(/\s/g, ' ');
  }

  private handleMediaInput(event: Event, kind: 'image' | 'file'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const maxSize = kind === 'image' ? 8 * 1024 * 1024 : 12 * 1024 * 1024;
    if (file.size > maxSize) {
      this.feedback.error(kind === 'image'
        ? "L'image ne doit pas depasser 8 Mo."
        : 'La piece jointe ne doit pas depasser 12 Mo.');
      return;
    }

    this.uploadMediaForComposer(file, kind);
  }

  private uploadMediaForComposer(file: File, kind: 'image' | 'file' | 'audio', durationSeconds = 0): void {
    const conversation = this.selectedConversation();
    if (!conversation || this.isUploadingMedia() || this.isSending()) {
      return;
    }

    this.selectedAttachmentName.set(file.name);
    this.isUploadingMedia.set(true);
    this.messagesService.uploadMedia(file).subscribe({
      next: ({ mediaUrl }) => {
        this.isUploadingMedia.set(false);
        this.pendingMediaUrl.set(mediaUrl);
        this.pendingMediaKind.set(kind);
        this.pendingVoiceDurationSeconds.set(durationSeconds);
      },
      error: () => {
        this.isUploadingMedia.set(false);
        this.selectedAttachmentName.set(null);
        this.feedback.error("Impossible d'envoyer ce media pour le moment.");
      },
    });
  }

  protected startVoiceRecording(): void {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.feedback.error("L'enregistrement vocal n'est pas disponible sur ce navigateur.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.voiceChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.voiceChunks.push(event.data);
          }
        };
        this.mediaRecorder.onstop = () => {
          const durationSeconds = this.voiceRecordingSeconds();
          this.clearVoiceRecordingTimer();
          this.stopVoiceLevelMeter();
          stream.getTracks().forEach((track) => track.stop());
          const voiceBlob = new Blob(this.voiceChunks, { type: 'audio/webm' });
          this.voiceChunks = [];
          if (voiceBlob.size === 0) {
            return;
          }

          const file = new File([voiceBlob], `message-vocal-${Date.now()}.webm`, {
            type: 'audio/webm',
          });
          this.uploadMediaForComposer(file, 'audio', durationSeconds);
        };
        this.mediaRecorder.start();
        this.startVoiceLevelMeter(stream);
        this.isRecordingVoice.set(true);
        this.voiceRecordingSeconds.set(0);
        this.voiceRecordingTimer = setInterval(() => {
          this.voiceRecordingSeconds.update((seconds) => seconds + 1);
        }, 1000);
      })
      .catch(() => {
        this.feedback.error("Autorisez le micro pour envoyer un message vocal.");
      });
  }

  protected stopVoiceRecording(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.isRecordingVoice.set(false);
      return;
    }

    this.mediaRecorder.stop();
    this.isRecordingVoice.set(false);
  }

  protected cancelVoiceRecording(): void {
    this.voiceChunks = [];
    this.clearVoiceRecordingTimer();
    this.stopVoiceLevelMeter();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.isRecordingVoice.set(false);
    this.voiceRecordingSeconds.set(0);
    this.voiceLevel.set(0);
  }

  private clearVoiceRecordingTimer(): void {
    if (!this.voiceRecordingTimer) {
      return;
    }

    clearInterval(this.voiceRecordingTimer);
    this.voiceRecordingTimer = null;
  }

  private startVoiceLevelMeter(stream: MediaStream): void {
    const AudioContextCtor = window.AudioContext || (
      window as typeof window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    this.stopVoiceLevelMeter();
    this.voiceAudioContext = new AudioContextCtor();
    this.voiceAnalyser = this.voiceAudioContext.createAnalyser();
    this.voiceAnalyser.fftSize = 256;
    const source = this.voiceAudioContext.createMediaStreamSource(stream);
    source.connect(this.voiceAnalyser);
    const data = new Uint8Array(this.voiceAnalyser.frequencyBinCount);

    const tick = () => {
      if (!this.voiceAnalyser) {
        return;
      }

      this.voiceAnalyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      this.voiceLevel.set(Math.min(1, average / 92));
      this.voiceLevelFrame = requestAnimationFrame(tick);
    };

    tick();
  }

  private stopVoiceLevelMeter(): void {
    if (this.voiceLevelFrame !== null) {
      cancelAnimationFrame(this.voiceLevelFrame);
      this.voiceLevelFrame = null;
    }
    this.voiceAnalyser = null;
    this.voiceAudioContext?.close().catch(() => undefined);
    this.voiceAudioContext = null;
    this.voiceLevel.set(0);
  }

  protected openCounterOffer(): void {
    const proposal = this.visibleProposalStep();
    if (!proposal || !this.canRespondToProposal()) {
      return;
    }

    this.errorMessage.set(null);
    this.counterOfferAmount.set(Math.max(500, Math.round(proposal.amount || 0)));
    this.isCounterOfferOpen.set(true);
  }

  protected closeCounterOffer(): void {
    if (this.isUpdatingProposal()) {
      return;
    }

    this.errorMessage.set(null);
    this.isCounterOfferOpen.set(false);
  }

  protected updateCounterOfferAmount(value: string): void {
    const amount = Number(value.replace(/[^\d]/g, ''));
    this.counterOfferAmount.set(Number.isFinite(amount) ? amount : 0);
  }

  protected updateCounterOfferAmountFromEvent(event: Event): void {
    this.updateCounterOfferAmount((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected sendCounterOffer(): void {
    const proposal = this.visibleProposalStep();
    if (!proposal || this.isUpdatingProposal()) {
      return;
    }

    if (!this.validateProposalResponse(proposal, 'counter')) {
      return;
    }

    const negotiationId = proposal.negotiationId;
    const amount = Math.round(this.counterOfferAmount() ?? 0);
    if (!negotiationId || !this.validateCounterOfferAmount(proposal, amount)) {
      return;
    }

    this.isUpdatingProposal.set(true);
    this.errorMessage.set(null);

    this.proposalService
      .counterPriceProposal(negotiationId, {
        serviceId: proposal.professionalId ?? negotiationId,
        proposedAmount: amount,
        message: `Nouvelle offre du prestataire: ${this.formatAmount(amount)} FCFA.`,
        dateHeure: proposal.appointmentDate ?? undefined,
        adresseClient: proposal.address ?? undefined,
        dureeMinutes: proposal.durationMinutes,
      })
      .subscribe({
        next: (updatedProposal) => {
          this.upsertProposal(updatedProposal);
          this.pendingProposal.update((current) =>
            current?.negotiationId === updatedProposal.id
              ? {
                  ...current,
                  amount: updatedProposal.montantCourant,
                  status: updatedProposal.statut,
                  reservationId: updatedProposal.reservationId,
                }
              : current,
          );
          this.isUpdatingProposal.set(false);
          this.isCounterOfferOpen.set(false);
          this.counterOfferAmount.set(null);
          this.feedback.success('Nouvelle offre envoyee au client.');
          this.notifyCounterOfferInConversation(updatedProposal);
        },
        error: () => {
          const message = "Impossible d'envoyer cette nouvelle offre.";
          this.errorMessage.set(message);
          this.feedback.error(message);
          this.isUpdatingProposal.set(false);
        },
      });
  }

  protected formatUnreadCount(value: number): string {
    return value > 99 ? '99+' : value.toString();
  }

  protected payAcceptedProposal(): void {
    const proposal = this.visibleProposalStep();

    if (!proposal || this.isPreparingPayment()) {
      return;
    }

    if (proposal.reservationId) {
      this.router.navigate(['/appointments', proposal.reservationId, 'payment'], {
        queryParams: this.buildPaymentReturnQuery(proposal),
      });
      return;
    }

    const draft = this.validateReservationPaymentDraft(proposal);
    if (!draft) {
      return;
    }

    this.createReservationCardFromProposal(proposal, draft);
  }

  private createReservationCardFromProposal(
    proposal: PendingProposal,
    draft: ReservationPaymentDraft,
  ): void {
    this.isPreparingPayment.set(true);
    this.errorMessage.set(null);
    this.proposalService
      .createReservationFromNegotiation({
        negotiationId: draft.negotiationId,
        dateHeure: draft.appointmentDate,
        adresseClient: draft.address,
        dureeMinutes: draft.durationMinutes,
        notes: `Reservation creee apres acceptation du prix propose: ${this.formatAmount(proposal.amount)} FCFA.`,
      })
      .subscribe({
        next: (reservation) => {
          this.isPreparingPayment.set(false);
          this.pendingProposal.update((current) =>
            current?.negotiationId === proposal.negotiationId
              ? {
                  ...current,
                  reservationId: reservation.id,
                  status: 'CONVERTIE_EN_RESERVATION',
                }
              : current,
          );
          this.router.navigate(['/appointments', reservation.id, 'payment'], {
            queryParams: this.buildPaymentReturnQuery({
              ...proposal,
              reservationId: reservation.id,
            }),
          });
          this.loadPriceProposals();
          this.refreshConversationsSilently();
        },
        error: (error) => {
          this.errorMessage.set(
            getHttpErrorMessage(error, 'Impossible de creer la reservation avant paiement.'),
          );
          this.isPreparingPayment.set(false);
        },
      });
  }

  protected cancelAcceptedProposal(): void {
    const proposal = this.visibleProposalStep();

    if (!proposal || this.isCancellingAcceptedProposal()) {
      return;
    }

    if (proposal.reservationId) {
      this.isCancellingAcceptedProposal.set(true);
      this.appointmentsService
        .cancelAppointment(proposal.reservationId, 'Annulation demandee depuis la messagerie.')
        .subscribe({
          next: () => {
            this.feedback.success('Reservation annulee.');
            this.appointmentPreview.set(null);
            this.pendingProposal.update((current) =>
              current?.negotiationId === proposal.negotiationId
                ? { ...current, status: 'ANNULEE', reservationId: null }
                : current,
            );
            this.isCancellingAcceptedProposal.set(false);
            this.loadPriceProposals();
            this.refreshConversationsSilently();
          },
          error: (error) => {
            this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'annuler cette reservation."));
            this.isCancellingAcceptedProposal.set(false);
          },
        });
      return;
    }

    if (!proposal.negotiationId) {
      this.errorMessage.set("Impossible d'annuler cette offre: identifiant manquant.");
      return;
    }

    this.isCancellingAcceptedProposal.set(true);
    this.proposalService
      .cancelPriceProposal(proposal.negotiationId, 'Annulation demandee par le client depuis la messagerie.')
      .subscribe({
        next: (updatedProposal) => {
          this.upsertProposal(updatedProposal);
          this.pendingProposal.update((current) =>
            current?.negotiationId === updatedProposal.id
              ? {
                  ...current,
                  amount: updatedProposal.montantCourant,
                  status: updatedProposal.statut,
                  reservationId: updatedProposal.reservationId,
                }
              : current,
          );
          this.feedback.success('Offre annulee.');
          this.isCancellingAcceptedProposal.set(false);
          this.loadPriceProposals();
          this.refreshConversationsSilently();
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'annuler cette offre."));
          this.isCancellingAcceptedProposal.set(false);
        },
      });
  }

  protected acceptProposal(): void {
    const proposal = this.visibleProposalStep();
    if (!proposal || this.isUpdatingProposal()) {
      return;
    }

    if (!this.validateProposalResponse(proposal, 'accept')) {
      return;
    }
    const negotiationId = proposal.negotiationId;
    if (!negotiationId) {
      return;
    }

    this.isUpdatingProposal.set(true);
    this.errorMessage.set(null);

    this.proposalService.acceptPriceProposal(negotiationId).subscribe({
      next: (updatedProposal) => {
        this.upsertProposal(updatedProposal);
        this.pendingProposal.update((current) =>
          current?.negotiationId === updatedProposal.id
            ? {
                ...current,
                amount: updatedProposal.montantCourant,
                status: updatedProposal.statut,
                reservationId: updatedProposal.reservationId,
              }
            : current,
        );
        this.isUpdatingProposal.set(false);
        this.isCounterOfferOpen.set(false);
        this.feedback.success('Proposition acceptee.');
      },
      error: () => {
        const message = "Impossible d'accepter cette proposition.";
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isUpdatingProposal.set(false);
      },
    });
  }

  protected rejectProposal(): void {
    const proposal = this.visibleProposalStep();
    if (!proposal || this.isUpdatingProposal()) {
      return;
    }

    if (!this.validateProposalResponse(proposal, 'reject')) {
      return;
    }
    const negotiationId = proposal.negotiationId;
    if (!negotiationId) {
      return;
    }

    this.isUpdatingProposal.set(true);
    this.errorMessage.set(null);

    this.proposalService.rejectPriceProposal(negotiationId, 'Proposition refusee par le prestataire.').subscribe({
      next: (updatedProposal) => {
        this.upsertProposal(updatedProposal);
        this.pendingProposal.update((current) =>
          current?.negotiationId === updatedProposal.id
            ? {
                ...current,
                amount: updatedProposal.montantCourant,
                status: updatedProposal.statut,
                reservationId: updatedProposal.reservationId,
              }
            : current,
        );
        this.isUpdatingProposal.set(false);
        this.isCounterOfferOpen.set(false);
        this.feedback.success('Proposition refusee.');
      },
      error: () => {
        const message = 'Impossible de refuser cette proposition.';
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isUpdatingProposal.set(false);
      },
    });
  }

  private loadConversations(): void {
    this.isLoadingConversations.set(true);
    this.errorMessage.set(null);

    if (!this.authSession.hasAuthenticatedSession()) {
      this.isLoadingConversations.set(false);
      return;
    }

    this.messagesService.listConversations().subscribe({
      next: (conversations) => {
        const sortedConversations = this.sortConversations(conversations);
        this.conversations.set(sortedConversations);
        const requestedConversationId = this.requestedConversationId();
        const requestedReservationId = this.requestedReservationId();
        const requestedNegotiationId = this.requestedNegotiationId();
        const requestedDirectConversation = this.findDirectConversation(sortedConversations);
        const requestedReservationConversation = sortedConversations.find(
          (conversation) => conversation.reservationId === requestedReservationId,
        );
        const requestedProposalConversation = this.findProposalConversation(sortedConversations);
        if (requestedReservationId && !requestedReservationConversation && !requestedConversationId) {
          this.openReservationConversation(requestedReservationId);
          return;
        }
        if (requestedNegotiationId && !requestedProposalConversation && !requestedConversationId) {
          this.openNegotiationConversation(requestedNegotiationId);
          return;
        }
        if (this.hasRequestedDirectConversation() && !requestedDirectConversation && !requestedConversationId) {
          this.openDirectConversation();
          return;
        }
        const selectedId =
          sortedConversations.find((conversation) => conversation.id === requestedConversationId)?.id ??
          requestedReservationConversation?.id ??
          requestedProposalConversation?.id ??
          requestedDirectConversation?.id ??
          sortedConversations[0]?.id ??
          null;
        this.selectedConversationId.set(selectedId);
        this.loadPriceProposals();
        this.isLoadingConversations.set(false);

        if (selectedId) {
          this.messages.set(this.messagesByConversation.get(selectedId) ?? []);
          this.scrollThreadToBottom();
          this.messagesRealtime.joinConversation(selectedId);
          this.loadMessages(selectedId);
        }
      },
      error: () => {
        const message = 'Impossible de charger vos conversations pour le moment.';
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoadingConversations.set(false);
      },
    });
  }

  private loadMessages(conversationId: string): void {
    const requestId = ++this.activeMessagesRequestId;
    const cachedMessages = this.messagesByConversation.get(conversationId);
    this.isLoadingMessages.set(!cachedMessages);

    this.messagesService.listMessages(conversationId, this.messagesPageSize).subscribe({
      next: (messages) => {
        if (requestId !== this.activeMessagesRequestId || conversationId !== this.selectedConversationId()) {
          return;
        }

        this.cacheConversationMessages(conversationId, messages);
        this.messages.set(this.messagesByConversation.get(conversationId) ?? []);
        this.scrollThreadToBottom();
        this.markConversationAsReadLocally(conversationId);
        this.isLoadingMessages.set(false);
        this.refreshConversationsSilently();
      },
      error: () => {
        if (requestId !== this.activeMessagesRequestId || conversationId !== this.selectedConversationId()) {
          return;
        }

        const message = 'Impossible de charger cette conversation.';
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoadingMessages.set(false);
      },
    });
  }

  private refreshConversationsSilently(): void {
    this.messagesService.listConversations().subscribe({
      next: (conversations) => this.conversations.set(this.sortConversations(conversations)),
    });
  }

  private openReservationConversation(reservationId: string): void {
    this.messagesService.createConversation({ reservationId }).subscribe({
      next: (conversation) => {
        this.conversations.set(this.sortConversations([conversation, ...this.conversations()]));
        this.selectedConversationId.set(conversation.id);
        this.requestedConversationId.set(conversation.id);
        this.loadPriceProposals();
        this.isLoadingConversations.set(false);
        this.messages.set(this.messagesByConversation.get(conversation.id) ?? []);
        this.scrollThreadToBottom();
        this.messagesRealtime.joinConversation(conversation.id);
        this.loadMessages(conversation.id);
      },
      error: () => {
        const message = "Impossible d'ouvrir la discussion liee a cette reservation.";
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoadingConversations.set(false);
      },
    });
  }

  private openNegotiationConversation(negotiationId: string): void {
    this.messagesService.createConversation({ negotiationId }).subscribe({
      next: (conversation) => {
        this.conversations.set(this.sortConversations([conversation, ...this.conversations()]));
        this.selectedConversationId.set(conversation.id);
        this.requestedConversationId.set(conversation.id);
        this.loadPriceProposals();
        this.isLoadingConversations.set(false);
        this.messages.set(this.messagesByConversation.get(conversation.id) ?? []);
        this.scrollThreadToBottom();
        this.messagesRealtime.joinConversation(conversation.id);
        this.loadMessages(conversation.id);
      },
      error: () => {
        const message = "Impossible d'ouvrir la discussion liee a cette negociation.";
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoadingConversations.set(false);
      },
    });
  }

  private openDirectConversation(): void {
    const professionalProfileId = this.normalizeUuid(
      this.requestedDirectProfessionalId(),
    ) ?? undefined;
    const professionalUserId = this.normalizeUuid(
      this.requestedDirectProfessionalUserId(),
    ) ?? undefined;
    if (!professionalProfileId && !professionalUserId) {
      this.isLoadingConversations.set(false);
      return;
    }

    this.messagesService
      .createConversation({ professionalProfileId, professionalUserId })
      .subscribe({
        next: (conversation) => {
          this.conversations.set(this.sortConversations([conversation, ...this.conversations()]));
          this.selectedConversationId.set(conversation.id);
          this.requestedConversationId.set(conversation.id);
          this.loadPriceProposals();
          this.isLoadingConversations.set(false);
          this.messages.set(this.messagesByConversation.get(conversation.id) ?? []);
          this.scrollThreadToBottom();
          this.messagesRealtime.joinConversation(conversation.id);
          this.loadMessages(conversation.id);
        },
        error: () => {
          const message = "Impossible d'ouvrir la discussion avec ce professionnel.";
          this.errorMessage.set(message);
          this.feedback.error(message);
          this.isLoadingConversations.set(false);
        },
      });
  }

  private loadPriceProposals(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    const scope = this.resolveNegotiationScope();
    if (!scope) {
      this.priceProposals.set([]);
      return;
    }

    this.proposalService.listMyPriceProposals(scope).subscribe({
      next: (proposals) => {
        this.priceProposals.set(proposals.filter((proposal) => this.isVisibleProposalStatus(proposal.statut)));
        this.loadAppointmentPreviewForVisibleProposal();
      },
      error: () => {
        this.priceProposals.set([]);
      },
    });
  }

  private refreshPendingProposalStatus(): void {
    const proposal = this.pendingProposal();

    if (!proposal?.negotiationId || !this.authSession.hasAuthenticatedSession()) {
      return;
    }

    const scope = this.resolveNegotiationScope();
    if (!scope) {
      return;
    }

    this.proposalService.listMyPriceProposals(scope).subscribe({
      next: (proposals) => {
        const currentProposal = proposals.find((item) => item.id === proposal.negotiationId);
        if (!currentProposal) {
          return;
        }

        this.pendingProposal.set({
          ...proposal,
          amount: currentProposal.montantCourant || proposal.amount,
          status: currentProposal.statut,
          reservationId: currentProposal.reservationId,
        });
        this.upsertProposal(currentProposal);
      },
      error: () => undefined,
    });
  }

  private startProposalRefresh(): void {
    if (!this.authSession.hasAuthenticatedSession() || this.proposalStatusRefreshId) {
      return;
    }

    this.proposalStatusRefreshId = setInterval(() => {
      this.refreshConversationsSilently();
      this.loadPriceProposals();
      const conversationId = this.selectedConversationId();
      if (conversationId) {
        this.refreshMessagesSilently(conversationId);
      }
      this.refreshPendingProposalStatus();
    }, 10000);
  }

  private readPendingProposalFromQuery(): void {
    const query = this.route.snapshot.queryParamMap;
    const rawAmount = Number(query.get('amount'));
    const professionalId = query.get('professionalId');
    const professionalUserId = query.get('professionalUserId');
    const conversationId = query.get('conversationId');
    const negotiationId = query.get('negotiationId');
    const reservationId = query.get('reservationId');
    const status = query.get('status');

    this.requestedConversationId.set(conversationId);
    this.requestedReservationId.set(reservationId);
    this.requestedNegotiationId.set(negotiationId);
    this.requestedDirectProfessionalId.set(professionalId);
    this.requestedDirectProfessionalUserId.set(professionalUserId);

    if (!negotiationId && !reservationId && !status && (!Number.isFinite(rawAmount) || rawAmount <= 0)) {
      return;
    }

    if (!professionalId && !Number.isFinite(rawAmount)) {
      return;
    }

    this.pendingProposal.set({
      negotiationId,
      conversationId,
      professionalId,
      providerName: query.get('providerName') || 'le prestataire',
      serviceName: query.get('serviceName') || 'service',
      amount: Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0,
      status,
      reservationId,
      appointmentDate: query.get('appointmentDate'),
      address: query.get('address'),
      durationMinutes: Number(query.get('durationMinutes')) || 60,
      proposalMessage: null,
    });
  }

  private hasRequestedDirectConversation(): boolean {
    return Boolean(this.requestedDirectProfessionalId() || this.requestedDirectProfessionalUserId());
  }

  private normalizeUuid(value: string | null): string | null {
    const candidate = value?.trim();
    if (!candidate) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate,
    )
      ? candidate
      : null;
  }

  private findDirectConversation(conversations: Conversation[]): Conversation | null {
    const professionalProfileId = this.requestedDirectProfessionalId();
    const professionalUserId = this.requestedDirectProfessionalUserId();
    if (!professionalProfileId && !professionalUserId) return null;

    return (
      conversations.find(
        (conversation) =>
          (professionalProfileId &&
            (conversation.professionalProfileId === professionalProfileId ||
              conversation.counterpart.professionalProfileId === professionalProfileId)) ||
          (professionalUserId &&
            (conversation.professionalUserId === professionalUserId ||
              conversation.counterpart.userId === professionalUserId)),
      ) ?? null
    );
  }

  private findProposalConversation(conversations: Conversation[]): Conversation | null {
    const proposal = this.pendingProposal();

    if (!proposal) {
      return null;
    }

    return (
      conversations.find((conversation) => conversation.id === proposal.conversationId) ??
      conversations.find(
        (conversation) =>
          conversation.counterpart.professionalProfileId === proposal.professionalId ||
          conversation.counterpart.name === proposal.providerName,
      ) ?? null
    );
  }

  private isProposalForConversation(
    proposal: PendingProposal,
    conversation: Conversation | null,
  ): boolean {
    if (!conversation) {
      return true;
    }

    return (
      conversation.id === proposal.conversationId ||
      conversation.counterpart.professionalProfileId === proposal.professionalId ||
      conversation.counterpart.name === proposal.providerName
    );
  }

  private proposalFromConversation(conversation: Conversation): PendingProposal | null {
    const professionalId =
      conversation.professionalProfileId ?? conversation.counterpart.professionalProfileId;
    const clientId =
      this.isProfessionalRole()
        ? conversation.counterpart.userId
        : this.currentUser()?.id;
    const proposal = this.priceProposals().find(
      (item) =>
        professionalId &&
        item.professionnelId === professionalId &&
        (!clientId || item.clientId === clientId),
    );

    if (!proposal) {
      return null;
    }
    const details = this.extractProposalDetails(proposal.messageCourant);

    return {
      negotiationId: proposal.id,
      conversationId: conversation.id,
      professionalId: proposal.professionnelId,
      providerName:
        this.isProfessionalRole()
          ? 'vous'
          : conversation.counterpart.name,
      serviceName: details.serviceName ?? 'service',
      amount: proposal.montantCourant || proposal.montantInitial,
      status: proposal.statut,
      reservationId: proposal.reservationId,
      appointmentDate: proposal.dateHeureProposee ?? details.appointmentDate,
      address: proposal.adresseClientProposee ?? details.address,
      durationMinutes: proposal.dureeMinutesProposee ?? details.durationMinutes ?? 60,
      proposalMessage: proposal.messageCourant,
    };
  }

  private isVisibleProposalStatus(status: string): boolean {
    return (
      status === 'EN_ATTENTE_PRESTATAIRE' ||
      status === 'EN_ATTENTE_CLIENT' ||
      status === 'ACCEPTEE' ||
      status === 'CONVERTIE_EN_RESERVATION'
    );
  }

  private resolveNegotiationScope(): 'CLIENT' | 'PRESTATAIRE' | null {
    const role = this.authSession.getAuthenticatedRole();
    if (role === 'CLIENT') return 'CLIENT';
    if (role === 'PRESTATAIRE' || role === 'MEDECIN') return 'PRESTATAIRE';
    return null;
  }

  private upsertProposal(proposal: NegotiationView): void {
    this.priceProposals.update((items) => {
      const others = items.filter((item) => item.id !== proposal.id);
      return this.isVisibleProposalStatus(proposal.statut)
        ? [proposal, ...others]
        : others;
    });
  }

  private refreshMessagesSilently(conversationId: string): void {
    this.messagesService.listMessages(conversationId, this.messagesPageSize).subscribe({
      next: (messages) => {
        this.cacheConversationMessages(conversationId, messages);
        if (conversationId === this.selectedConversationId()) {
          this.messages.set(this.messagesByConversation.get(conversationId) ?? []);
          this.scrollThreadToBottom();
        }
      },
    });
  }

  private startRealtimeMessaging(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.messagesRealtime.connect();
    this.realtimeMessageSubscription = this.messagesRealtime.messageCreated$.subscribe((message) => {
      const isSelectedConversation = message.conversationId === this.selectedConversationId();
      this.upsertConversationFromMessage(message, isSelectedConversation);

      if (!isSelectedConversation) {
        this.refreshConversationsSilently();
        return;
      }

      this.upsertMessage(message);
      this.messagesRealtime.joinConversation(message.conversationId);
      this.refreshConversationsSilently();
    });
  }

  private upsertMessage(message: ConversationMessage): void {
    const cachedMessages = this.mergeMessage(
      this.messagesByConversation.get(message.conversationId) ?? [],
      message,
    );
    this.messagesByConversation.set(message.conversationId, cachedMessages);

    if (message.conversationId !== this.selectedConversationId()) {
      return;
    }

    this.messages.update((items) => {
      if (items.some((item) => item.id === message.id)) {
        return items;
      }

      return this.sortMessages([...items, message]);
    });
    this.scrollThreadToBottom();
  }

  private upsertConversationFromMessage(message: ConversationMessage, isOpen: boolean): void {
    const shouldIncrementUnread = !isOpen && !this.isOwnMessage(message);

    this.conversations.update((items) => {
      const nextItems = items.map((conversation) => {
        if (conversation.id !== message.conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          lastMessageAt: message.createdAt,
          unreadCount: shouldIncrementUnread ? conversation.unreadCount + 1 : conversation.unreadCount,
          lastMessage: {
            id: message.id,
            senderId: message.senderId,
            content: message.content,
            mediaUrl: message.mediaUrl,
            createdAt: message.createdAt,
          },
        };
      });

      return this.sortConversations(nextItems);
    });
  }

  private cacheConversationMessages(
    conversationId: string,
    messages: ConversationMessage[],
  ): void {
    this.messagesByConversation.set(conversationId, this.sortMessages(messages));
  }

  private mergeMessage(
    messages: ConversationMessage[],
    message: ConversationMessage,
  ): ConversationMessage[] {
    const withoutDuplicate = messages.filter((item) => item.id !== message.id);
    return this.sortMessages([...withoutDuplicate, message]);
  }

  private sortMessages(messages: ConversationMessage[]): ConversationMessage[] {
    return [...messages].sort((first, second) => {
      const firstTime = new Date(first.createdAt).getTime();
      const secondTime = new Date(second.createdAt).getTime();
      return firstTime - secondTime;
    });
  }

  private sortConversations(conversations: Conversation[]): Conversation[] {
    return [...conversations].sort((first, second) => {
      const firstTime = new Date(first.lastMessageAt || first.createdAt).getTime();
      const secondTime = new Date(second.lastMessageAt || second.createdAt).getTime();
      return secondTime - firstTime;
    });
  }

  private scrollThreadToBottom(): void {
    if (this.pendingThreadScrollId) {
      clearTimeout(this.pendingThreadScrollId);
    }

    this.pendingThreadScrollId = setTimeout(() => {
      const thread = this.messageThread?.nativeElement;
      if (!thread) return;
      thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
      this.pendingThreadScrollId = null;
    }, 0);
  }

  private markConversationAsReadLocally(conversationId: string): void {
    this.conversations.update((items) =>
      items.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
  }

  private loadAppointmentPreviewForVisibleProposal(): void {
    const proposal = this.visibleProposal();
    if (!proposal?.reservationId) {
      return;
    }

    if (this.appointmentPreview()?.id === proposal.reservationId) {
      return;
    }

    this.loadAppointmentPreview(proposal.reservationId);
  }

  private loadAppointmentPreview(reservationId: string): void {
    this.isLoadingAppointmentPreview.set(true);
    this.appointmentsService.getAppointmentById(reservationId).subscribe({
      next: (appointment) => {
        this.appointmentPreview.set(appointment);
        this.isLoadingAppointmentPreview.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger le resume du rendez-vous.');
        this.isLoadingAppointmentPreview.set(false);
      },
    });
  }

  private extractProposalDetails(message: string | null): {
    appointmentDate: string | null;
    address: string | null;
    durationMinutes: number | null;
    serviceName: string | null;
  } {
    if (!message) {
      return {
        appointmentDate: null,
        address: null,
        durationMinutes: null,
        serviceName: null,
      };
    }

    const serviceMatch = message.match(/Service:\s*([^.]+)\./i);
    const dateMatch = message.match(/Date souhaitee:\s*([^.]+)\./i);
    const addressMatch = message.match(/Adresse:\s*([^.]+)\./i);
    const durationMatch = message.match(/Duree:\s*(\d{1,4})\s*minutes?\./i);
    const parsedDuration = durationMatch ? Number(durationMatch[1]) : null;
    const durationMinutes =
      typeof parsedDuration === 'number' &&
      Number.isInteger(parsedDuration) &&
      parsedDuration >= 5 &&
      parsedDuration <= 1440
        ? parsedDuration
        : null;

    return {
      appointmentDate: dateMatch ? this.parseProposalDate(dateMatch[1]) : null,
      address: addressMatch?.[1]?.trim() || null,
      durationMinutes,
      serviceName: serviceMatch?.[1]?.trim() || null,
    };
  }

  private resolveReservationDraft(proposal: PendingProposal): {
    appointmentDate: string | null;
    address: string | null;
    durationMinutes: number;
  } {
    const messageDetails = this.extractProposalDetails(proposal.proposalMessage || proposal.serviceName);

    return {
      appointmentDate: proposal.appointmentDate || messageDetails.appointmentDate,
      address: proposal.address || messageDetails.address,
      durationMinutes: proposal.durationMinutes || messageDetails.durationMinutes || 60,
    };
  }

  private parseProposalDate(value: string): string | null {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const match = normalized.match(
      /^(\d{1,2})\s+([A-Z]+)\s+(\d{4})(?:(?:\s+(?:A|À))?\s+(\d{1,2})[:H](\d{2}))?$/,
    );
    if (!match) {
      return null;
    }

    const months: Record<string, number> = {
      JANVIER: 0,
      FEVRIER: 1,
      MARS: 2,
      AVRIL: 3,
      MAI: 4,
      JUIN: 5,
      JUILLET: 6,
      AOUT: 7,
      SEPTEMBRE: 8,
      OCTOBRE: 9,
      NOVEMBRE: 10,
      DECEMBRE: 11,
    };
    const month = months[match[2]];
    if (month === undefined) {
      return null;
    }

    const hours = match[4] ? Number(match[4]) : 12;
    const minutes = match[5] ? Number(match[5]) : 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1]), hours, minutes, 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private notifyCounterOfferInConversation(proposal: NegotiationView): void {
    const conversationId = this.selectedConversationId();
    if (!conversationId) {
      return;
    }

    const message = `J'ai refuse l'offre initiale et propose ${this.formatAmount(
      proposal.montantCourant,
    )} FCFA.`;

    this.messagesService.sendMessage(conversationId, message).subscribe({
      next: (createdMessage) => {
        this.upsertMessage(createdMessage);
        this.refreshConversationsSilently();
      },
      error: () => undefined,
    });
  }

  private buildPaymentReturnQuery(proposal: PendingProposal): Record<string, string | number> {
    const query: Record<string, string | number> = {
      returnTo: 'messages',
      reservationId: proposal.reservationId || '',
      professionalId: proposal.professionalId || '',
      providerName: proposal.providerName,
      serviceName: proposal.serviceName,
      amount: proposal.amount,
      status: proposal.status || '',
    };

    const conversationId = proposal.conversationId || this.selectedConversationId();
    if (conversationId) {
      query['conversationId'] = conversationId;
    }

    if (proposal.negotiationId) {
      query['negotiationId'] = proposal.negotiationId;
    }

    if (proposal.appointmentDate) {
      query['appointmentDate'] = proposal.appointmentDate;
    }

    if (proposal.address) {
      query['address'] = proposal.address;
    }

    if (proposal.durationMinutes) {
      query['durationMinutes'] = proposal.durationMinutes;
    }

    return query;
  }

  private validateCounterOfferAmount(proposal: PendingProposal, amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 500) {
      this.errorMessage.set('Saisissez une nouvelle offre valide, a partir de 500 FCFA.');
      return false;
    }

    if (amount > 100_000_000) {
      this.errorMessage.set('Le montant de la nouvelle offre est trop eleve.');
      return false;
    }

    if (amount === Math.round(proposal.amount)) {
      this.errorMessage.set('La contre-proposition doit etre differente du prix propose par le client.');
      return false;
    }

    return true;
  }

  private validateProposalResponse(
    proposal: PendingProposal,
    action: 'accept' | 'reject' | 'counter',
  ): boolean {
    if (!this.isProfessionalRole()) {
      this.errorMessage.set('Seul le prestataire peut traiter cette proposition.');
      return false;
    }

    if (!proposal.negotiationId) {
      this.errorMessage.set('Impossible de traiter cette proposition: identifiant manquant.');
      return false;
    }

    if (proposal.status !== 'EN_ATTENTE_PRESTATAIRE') {
      const actionLabel =
        action === 'accept' ? 'acceptee' : action === 'reject' ? 'refusee' : 'modifiee';
      this.errorMessage.set(`Cette proposition ne peut plus etre ${actionLabel}.`);
      return false;
    }

    if (!Number.isFinite(proposal.amount) || proposal.amount <= 0) {
      this.errorMessage.set('Impossible de traiter cette proposition: montant invalide.');
      return false;
    }

    return true;
  }

  private validateReservationPaymentDraft(
    proposal: PendingProposal,
  ): ReservationPaymentDraft | null {
    if (this.currentUser()?.role !== 'CLIENT') {
      this.errorMessage.set('Seul le client peut preparer le paiement de cette reservation.');
      return null;
    }

    if (proposal.status !== 'ACCEPTEE') {
      this.errorMessage.set('Le paiement est disponible seulement apres acceptation du prix.');
      return null;
    }

    if (!proposal.negotiationId) {
      this.errorMessage.set('Impossible de creer la reservation: proposition introuvable.');
      return null;
    }

    if (!Number.isFinite(proposal.amount) || proposal.amount <= 0) {
      this.errorMessage.set('Impossible de creer la reservation: montant invalide.');
      return null;
    }

    const draft = this.resolveReservationDraft(proposal);
    const appointmentDate = draft.appointmentDate;
    const scheduledAt = appointmentDate ? new Date(appointmentDate) : null;
    if (!appointmentDate || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      this.errorMessage.set('Impossible de creer la reservation: date du rendez-vous manquante.');
      return null;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      this.errorMessage.set('Impossible de creer la reservation: la date du rendez-vous est deja passee.');
      return null;
    }

    const address = draft.address?.trim().replace(/\s+/g, ' ') ?? '';
    if (address.length < 5 || address.length > 180) {
      this.errorMessage.set('Impossible de creer la reservation: adresse du rendez-vous invalide.');
      return null;
    }

    const durationMinutes = Math.trunc(Number(draft.durationMinutes));
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
      this.errorMessage.set('Impossible de creer la reservation: duree du rendez-vous invalide.');
      return null;
    }

    return {
      negotiationId: proposal.negotiationId,
      appointmentDate,
      address,
      durationMinutes,
    };
  }

  private isProfessionalRole(): boolean {
    const role = this.currentUser()?.role;
    return role === 'PRESTATAIRE' || role === 'MEDECIN';
  }

  private isCurrentUserId(userId: string | null | undefined): boolean {
    const currentUserId = this.currentUser()?.id;
    return Boolean(userId && currentUserId && userId.trim() === currentUserId.trim());
  }

  private isPaidAppointmentStatus(status: AppointmentView['status']): boolean {
    return this.isPaidConversationStatus(status);
  }

  private isPaidConversationStatus(status: string | null | undefined): boolean {
    return (
      status === 'PAYEE_SEQUESTRE' ||
      status === 'CONFIRMEE' ||
      status === 'EN_COURS' ||
      status === 'TERMINEE' ||
      status === 'ANNULEE' ||
      status === 'LITIGE'
    );
  }
}
