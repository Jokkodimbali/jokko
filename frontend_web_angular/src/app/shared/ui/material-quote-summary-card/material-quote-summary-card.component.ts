import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export interface MaterialQuoteSummaryItem {
  designation: string;
  quantity: number;
  status?: string;
}

@Component({
  selector: 'app-material-quote-summary-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './material-quote-summary-card.component.html',
  styleUrl: './material-quote-summary-card.component.scss',
})
export class MaterialQuoteSummaryCardComponent implements OnChanges, OnDestroy {
  @Input() items: readonly MaterialQuoteSummaryItem[] = [];
  @Input() showDeliveryAction = true;
  @Output() readonly deliveryRequested = new EventEmitter<void>();

  protected expanded = false;
  protected attentionActive = false;
  private previousItemsFingerprint = '';
  private attentionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['items']) return;

    const fingerprint = this.items
      .filter((item) => item.status !== 'REFUSE')
      .map((item) => `${item.designation.trim().toLocaleLowerCase('fr-FR')}:${item.quantity}`)
      .sort()
      .join('|');
    const previousFingerprint = this.previousItemsFingerprint;
    this.previousItemsFingerprint = fingerprint;

    if (!fingerprint || fingerprint === previousFingerprint) return;

    this.expanded = true;
    this.attentionActive = true;
    if (this.attentionTimeoutId) clearTimeout(this.attentionTimeoutId);
    this.attentionTimeoutId = setTimeout(() => {
      this.attentionActive = false;
      this.attentionTimeoutId = null;
    }, 10_000);
  }

  ngOnDestroy(): void {
    if (this.attentionTimeoutId) clearTimeout(this.attentionTimeoutId);
  }

  protected get visibleItems(): readonly MaterialQuoteSummaryItem[] {
    return this.items.filter((item) => item.status !== 'REFUSE');
  }

  protected get countLabel(): string {
    const count = this.visibleItems.length;
    return `${count} ${count > 1 ? 'articles' : 'article'}`;
  }
}
