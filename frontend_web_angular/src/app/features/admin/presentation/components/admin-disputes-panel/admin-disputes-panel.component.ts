import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AdminDisputeCase, AdminDisputeMessage } from '../../../data-access/admin.models';

type DisputeAction =
  | 'review'
  | 'refund-client'
  | 'credit-professional'
  | 'message-client'
  | 'message-professional'
  | 'message-both';

type DisputeThreadItem = {
  id: string;
  author: string;
  content: string;
  mediaUrl: string | null;
  tone: 'client' | 'professional' | 'moderation';
  createdAt: string | Date;
};

type FinancialDecisionAction = Extract<DisputeAction, 'refund-client' | 'credit-professional'>;
type FinancialDecisionBeneficiary = 'CLIENT' | 'PRESTATAIRE';

type FinancialDecisionState = {
  action: FinancialDecisionAction;
  beneficiary: FinancialDecisionBeneficiary;
  disputeId: string;
};

@Component({
  selector: 'app-admin-disputes-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-disputes-panel.component.html',
  styleUrl: './admin-disputes-panel.component.scss',
})
export class AdminDisputesPanelComponent implements OnChanges {
  @Input({ required: true }) disputes: AdminDisputeCase[] = [];
  @Input() isLoading = false;
  @Input() actionId: string | null = null;
  @Output() action = new EventEmitter<{
    disputeId: string;
    action: DisputeAction;
    notes?: string;
    clientRefundPercentage?: number;
  }>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly resolutionNote = signal('');
  protected readonly financialDecision = signal<FinancialDecisionState | null>(null);
  protected readonly financialAmount = signal('');
  protected readonly financialNote = signal('');
  protected readonly selectedDispute = computed(
    () => this.disputes.find((dispute) => dispute.id === this.selectedId()) ?? this.disputes[0] ?? null,
  );
  protected readonly averageResponseLabel = computed(() => this.computeAverageResponseLabel());

  ngOnChanges(): void {
    if (!this.disputes.some((dispute) => dispute.id === this.selectedId())) {
      this.selectedId.set(this.disputes[0]?.id ?? null);
    }
  }

  protected select(disputeId: string): void {
    this.selectedId.set(disputeId);
    this.resolutionNote.set('');
    this.closeFinancialDecision();
  }

  protected updateNote(event: Event): void {
    this.resolutionNote.set((event.target as HTMLTextAreaElement).value);
  }

  protected runAction(action: DisputeAction): void {
    const dispute = this.selectedDispute();
    if (!dispute || this.isClosed(dispute)) return;

    const notes = this.resolutionNote().trim();
    if (action === 'review') {
      this.action.emit({ disputeId: dispute.id, action });
      return;
    }

    if (action === 'message-client' || action === 'message-professional' || action === 'message-both') {
      if (notes.length < 2) return;
      this.action.emit({ disputeId: dispute.id, action, notes });
      this.resolutionNote.set('');
      return;
    }

    if (notes.length < 10) return;
    this.action.emit({ disputeId: dispute.id, action, notes });
  }

  protected openFinancialDecision(action: FinancialDecisionAction): void {
    const dispute = this.selectedDispute();
    if (!dispute || this.isClosed(dispute)) return;

    const beneficiary: FinancialDecisionBeneficiary = action === 'refund-client' ? 'CLIENT' : 'PRESTATAIRE';
    this.financialDecision.set({ action, beneficiary, disputeId: dispute.id });
    this.financialAmount.set(String(this.defaultFinancialAmount(dispute, action)));
    this.financialNote.set(this.resolutionNote().trim());
  }

  protected closeFinancialDecision(): void {
    this.financialDecision.set(null);
    this.financialAmount.set('');
    this.financialNote.set('');
  }

  protected selectFinancialBeneficiary(beneficiary: FinancialDecisionBeneficiary): void {
    const dispute = this.selectedDispute();
    const current = this.financialDecision();
    if (!dispute || !current) return;

    const action: FinancialDecisionAction = beneficiary === 'CLIENT' ? 'refund-client' : 'credit-professional';
    this.financialDecision.set({ ...current, action, beneficiary });
    this.financialAmount.set(String(this.defaultFinancialAmount(dispute, action)));
  }

  protected updateFinancialAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/[^\d]/g, '');
    this.financialAmount.set(value);
  }

  protected updateFinancialNote(event: Event): void {
    this.financialNote.set((event.target as HTMLInputElement).value);
  }

  protected confirmFinancialDecision(): void {
    const decision = this.financialDecision();
    const dispute = this.selectedDispute();
    if (!decision || !dispute || this.isClosed(dispute) || !this.canConfirmFinancialDecision()) return;

    const notes = this.financialNote().trim();
    this.action.emit({
      disputeId: decision.disputeId,
      action: decision.action,
      notes,
      clientRefundPercentage: this.resolveClientRefundPercentage(dispute, decision.action),
    });
    this.resolutionNote.set('');
    this.closeFinancialDecision();
  }

  protected canConfirmFinancialDecision(): boolean {
    return this.financialNote().trim().length >= 10 && this.parseFinancialAmount() > 0;
  }

  protected title(dispute: AdminDisputeCase): string {
    return `${dispute.client.nom} vs ${dispute.professional.nom}`;
  }

  protected serviceLabel(dispute: AdminDisputeCase): string {
    return dispute.reservation.service.nom;
  }

  protected disputeAmount(dispute: AdminDisputeCase): number {
    return dispute.payment?.montant ?? dispute.reservation.prixConvenu ?? dispute.reservation.service.prix;
  }

  protected professionalDecisionAmount(dispute: AdminDisputeCase): number {
    return dispute.payment?.montantNet ?? this.disputeAmount(dispute);
  }

  protected shortDisputeCode(dispute: AdminDisputeCase): string {
    return `L-${dispute.id.slice(0, 4).toUpperCase()}`;
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      OUVERT: 'Nouveau',
      EN_REVUE: 'En mediation',
      RESOLU: 'Resolu',
      REJETE: 'Rejete',
    };
    return labels[status] ?? status;
  }

  protected priorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      HAUTE: 'Priorite haute',
      MOYENNE: 'Priorite moyenne',
      BASSE: 'Priorite basse',
    };
    return labels[priority] ?? priority;
  }

  protected formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected relativeTime(date: string | Date): string {
    const diffMs = Date.now() - new Date(date).getTime();
    const minutes = Math.max(1, Math.round(diffMs / 60_000));
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.round(hours / 24);
    return `Il y a ${days} j`;
  }

  protected threadItems(dispute: AdminDisputeCase): DisputeThreadItem[] {
    const conversationItems = dispute.reservation.messages.map((message) => ({
      id: message.id,
      author: this.messageAuthor(dispute, message),
      content: message.contenu || 'Piece jointe envoyee.',
      mediaUrl: message.urlMedia,
      tone: this.messageTone(dispute, message),
      createdAt: message.creeLe,
    }));
    const mediationItems = dispute.reservation.mediationMessages.map((message) => ({
      id: message.id,
      author: `Moderation -> ${this.recipientLabel(message.destinataire)}`,
      content: message.contenu,
      mediaUrl: null,
      tone: 'moderation' as const,
      createdAt: message.creeLe,
    }));
    const items = [...conversationItems, ...mediationItems].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
    if (items.length > 0) return items;

    return [
      {
        id: `${dispute.id}-reason`,
        author: dispute.reporter.id === dispute.professional.userId ? 'Prestataire' : 'CLIENTS',
        content: dispute.raison,
        mediaUrl: null,
        tone: dispute.reporter.id === dispute.professional.userId ? 'professional' : 'client',
        createdAt: dispute.ouvertLe,
      },
    ];
  }

  protected isClosed(dispute: AdminDisputeCase): boolean {
    return dispute.statut === 'RESOLU' || dispute.statut === 'REJETE';
  }

  protected canResolve(dispute: AdminDisputeCase): boolean {
    return !this.isClosed(dispute) && this.resolutionNote().trim().length >= 10;
  }

  protected canSendMessage(dispute: AdminDisputeCase): boolean {
    return !this.isClosed(dispute) && this.resolutionNote().trim().length >= 2;
  }

  protected recipientLabel(recipient: string): string {
    const labels: Record<string, string> = {
      CLIENT: 'client',
      PRESTATAIRE: 'prestataire',
      TOUS: 'client + prestataire',
    };
    return labels[recipient] ?? recipient;
  }

  protected financialBeneficiaryTitle(dispute: AdminDisputeCase, beneficiary: FinancialDecisionBeneficiary): string {
    return beneficiary === 'CLIENT' ? dispute.client.nom : dispute.professional.nom;
  }

  protected financialBeneficiarySubtitle(beneficiary: FinancialDecisionBeneficiary): string {
    return beneficiary === 'CLIENT' ? 'Remboursement au client' : 'Versement au prestataire';
  }

  private defaultFinancialAmount(dispute: AdminDisputeCase, action: FinancialDecisionAction): number {
    return action === 'refund-client' ? this.disputeAmount(dispute) : this.professionalDecisionAmount(dispute);
  }

  private parseFinancialAmount(): number {
    return Number(this.financialAmount().replace(/[^\d]/g, '')) || 0;
  }

  private resolveClientRefundPercentage(dispute: AdminDisputeCase, action: FinancialDecisionAction): number {
    const amount = this.parseFinancialAmount();
    const grossAmount = Math.max(this.disputeAmount(dispute), 1);
    if (action === 'refund-client') {
      return this.clampPercentage((amount / grossAmount) * 100);
    }

    const professionalBase = Math.max(this.professionalDecisionAmount(dispute), 1);
    return this.clampPercentage(100 - (amount / professionalBase) * 100);
  }

  private clampPercentage(value: number): number {
    return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
  }

  private messageAuthor(dispute: AdminDisputeCase, message: AdminDisputeMessage): string {
    if (message.expediteurId === dispute.client.id) return 'CLIENTS';
    if (message.expediteurId === dispute.professional.userId) return 'Prestataire';
    return 'Moderation';
  }

  private messageTone(dispute: AdminDisputeCase, message: AdminDisputeMessage): DisputeThreadItem['tone'] {
    if (message.expediteurId === dispute.client.id) return 'client';
    if (message.expediteurId === dispute.professional.userId) return 'professional';
    return 'moderation';
  }

  private computeAverageResponseLabel(): string {
    const durations = this.disputes
      .map((dispute) => {
        const end = dispute.prisEnChargeLe ?? dispute.resoluLe ?? dispute.rejeteLe;
        return end ? new Date(end).getTime() - new Date(dispute.ouvertLe).getTime() : null;
      })
      .filter((duration): duration is number => typeof duration === 'number' && duration >= 0);

    if (durations.length === 0) return 'temps de reponse non disponible';
    const averageMinutes = Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 60_000);
    const hours = Math.floor(averageMinutes / 60);
    const minutes = averageMinutes % 60;
    return `temps de reponse moyen : ${hours > 0 ? `${hours} h ` : ''}${minutes} min`;
  }
}
