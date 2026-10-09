import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { publicAssetUrl } from '../../../shared/utils/public-asset-url';
import {
  Tender,
  TenderAction,
  TenderResponse,
  TENDER_STATUS_LABELS,
} from '../data-access/tenders.models';
import { TenderPriceControlComponent } from './tender-price-control.component';
@Component({
  selector: 'app-tender-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    TenderPriceControlComponent,
  ],
  templateUrl: './tender-detail.component.html',
  styleUrls: ['./tenders.shared.scss', './tender-detail.component.scss'],
})
export class TenderDetailComponent implements OnChanges {
  @Input({ required: true }) tender!: Tender;
  @Input() isClient = false;
  @Input() busy = false;
  @Output() readonly action = new EventEmitter<TenderAction>();
  protected readonly labels = TENDER_STATUS_LABELS;
  protected readonly asset = publicAssetUrl;
  protected price = 10000;
  protected counterPrice = 10000;
  protected counterOpen = false;
  protected confirmCancel = false;
  protected serviceId = '';
  protected message = '';
  private loadedKey = '';
  ngOnChanges() {
    const key = `${this.tender.id}:${this.tender.revision}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    this.price = this.tender.proposedPrice;
    this.counterPrice = this.mine?.amount ?? this.tender.proposedPrice;
    this.serviceId = this.mine?.serviceId ?? this.mine?.services[0]?.id ?? '';
    this.counterOpen = false;
    this.confirmCancel = false;
    this.message = '';
  }
  protected get offers() {
    return this.tender.responses.filter((response) => response.status === 'OFFERED');
  }
  protected get activeInvitations() {
    return this.tender.responses.filter((response) => response.status !== 'NOT_SELECTED');
  }
  protected get selected() {
    return this.tender.responses.find((response) => response.status === 'SELECTED');
  }
  protected get mine() {
    return this.isClient ? undefined : this.tender.responses[0];
  }
  protected get canRespond() {
    return (
      this.tender.status === 'OPEN' &&
      this.mine &&
      ['INVITED', 'OFFERED', 'REJECTED'].includes(this.mine.status)
    );
  }
  protected initials(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  protected submitResponse(amount: number) {
    if (!this.serviceId || this.busy) return;
    this.action.emit({
      kind: 'respond',
      serviceId: this.serviceId,
      amount,
      message: this.message.trim() || undefined,
    });
  }
  protected reservationQuery(response: TenderResponse) {
    return {
      negotiationId: response.negotiationId,
      serviceId: response.serviceId,
      address: this.tender.address,
      appointmentDate: this.tender.scheduledAt,
      clientLatitude: this.tender.latitude,
      clientLongitude: this.tender.longitude,
    };
  }
}
