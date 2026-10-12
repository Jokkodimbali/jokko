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
  @Input() reservationError = '';
  @Output() readonly action = new EventEmitter<TenderAction>();
  @Output() readonly finalize = new EventEmitter<{ responseId: string; appointmentDate: string; durationMinutes: number }>();
  protected readonly asset = publicAssetUrl;
  protected price = 10000;
  protected confirmCancel = false;
  protected appointmentDate = '';
  protected completionError = '';
  protected dateError = '';
  protected serviceError = '';
  protected addressError = '';
  private loadedKey = '';
  private loadedTenderId = '';
  ngOnChanges() {
    const key = `${this.tender.id}:${this.tender.revision}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    this.price = this.tender.proposedPrice;
    this.confirmCancel = false;
    if (this.loadedTenderId !== this.tender.id) {
      this.loadedTenderId = this.tender.id;
      this.showAcceptedDate = false;
      this.appointmentDate = this.tender.scheduledAt
        ? this.toLocalDateTime(this.tender.scheduledAt)
        : '';
    }
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
  protected get needsAppointmentDate() {
    return !this.tender.scheduledAt || new Date(this.tender.scheduledAt).getTime() <= Date.now();
  }
  protected showAcceptedDate = false;
  protected completeSelectedOffer(response: TenderResponse) {
    this.dateError = '';
    this.serviceError = '';
    this.addressError = '';
    this.completionError = '';
    const date = new Date(this.appointmentDate);
    if (!this.appointmentDate || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      this.showAcceptedDate = true;
      this.dateError = 'Choisissez une date et une heure futures.';
    }
    if (!this.tender.address.trim()) this.addressError = 'Ajoutez une adresse d’intervention.';
    if (!response.serviceId) this.serviceError = 'Le service du prestataire est indisponible. Choisissez une autre offre.';
    const serviceDuration = response.serviceDurationMinutes;
    const duration = serviceDuration != null && Number.isInteger(serviceDuration) &&
      serviceDuration >= 5 && serviceDuration <= 1440 ? serviceDuration : 60;
    if (this.dateError || this.serviceError || this.addressError) return;
    const appointmentDate = this.tender.scheduledAt &&
      this.appointmentDate === this.toLocalDateTime(this.tender.scheduledAt)
      ? this.tender.scheduledAt
      : date.toISOString();
    this.finalize.emit({ responseId: response.id, appointmentDate, durationMinutes: duration });
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
  private toLocalDateTime(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
}
