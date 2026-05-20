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
  @Output() action = new EventEmitter<{ disputeId: string; action: DisputeAction; notes?: string }>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly resolutionNote = signal('');
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

  protected title(dispute: AdminDisputeCase): string {
    return `${dispute.client.nom} vs ${dispute.professional.nom}`;
  }

  protected serviceLabel(dispute: AdminDisputeCase): string {
    return dispute.reservation.service.nom;
  }

  protected disputeAmount(dispute: AdminDisputeCase): number {
    return dispute.payment?.montant ?? dispute.reservation.prixConvenu ?? dispute.reservation.service.prix;
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
