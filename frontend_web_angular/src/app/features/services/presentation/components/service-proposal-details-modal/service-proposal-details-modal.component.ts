import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ReservationAvailabilitySlotView } from '../../../data-access/service-proposal.service';
import { BackendProfessionalDetailService } from '../../../domain/models/services.models';
import { ServiceProposalInteractiveMapComponent } from '../service-proposal-interactive-map/service-proposal-interactive-map.component';

export type ProposalDetailsModal = 'service' | 'schedule' | 'address';

export interface ProposalAddressSuggestion {
  id: string;
  label: string;
  detail: string;
  latitude: number | null;
  longitude: number | null;
  source: 'GOOGLE_PLACES' | 'OPENSTREETMAP';
}

@Component({
  selector: 'app-service-proposal-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ServiceProposalInteractiveMapComponent],
  templateUrl: './service-proposal-details-modal.component.html',
  styleUrl: './service-proposal-details-modal.component.scss',
})
export class ServiceProposalDetailsModalComponent {
  @ViewChild(ServiceProposalInteractiveMapComponent)
  private readonly interactiveMap?: ServiceProposalInteractiveMapComponent;

  @Input({ required: true }) mode!: ProposalDetailsModal;
  @Input() services: BackendProfessionalDetailService[] = [];
  @Input() selectedServiceId = '';
  @Input() fallbackServiceName = 'Service Jokko';
  @Input() fallbackServicePrice = 0;
  @Input() appointmentDay = '';
  @Input() minAppointmentDay = '';
  @Input() slots: ReservationAvailabilitySlotView[] = [];
  @Input() selectedDateTime = '';
  @Input() availabilityLabel = '';
  @Input() loadingSlots = false;
  @Input() address = '';
  @Input() suggestions: ProposalAddressSuggestion[] = [];
  @Input() loadingSuggestions = false;
  @Input() locatingAddress = false;
  protected isAddressMapExpanded = false;
  protected isCreatingCustomService = false;
  protected customServiceName = '';

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly serviceSelected = new EventEmitter<string>();
  @Output() readonly customServiceCreated = new EventEmitter<string>();
  @Output() readonly dayChanged = new EventEmitter<string>();
  @Output() readonly slotSelected = new EventEmitter<ReservationAvailabilitySlotView>();
  @Output() readonly addressChanged = new EventEmitter<string>();
  @Output() readonly suggestionSelected = new EventEmitter<ProposalAddressSuggestion>();
  @Output() readonly locate = new EventEmitter<void>();

  protected isSelectedSlot(slot: ReservationAvailabilitySlotView): boolean {
    const slotTimestamp = new Date(slot.dateHeure).getTime();
    const selectedTimestamp = new Date(this.selectedDateTime).getTime();
    return Number.isFinite(slotTimestamp) && slotTimestamp === selectedTimestamp;
  }

  protected serviceName(service: BackendProfessionalDetailService): string {
    return service.nom?.trim() || this.fallbackServiceName;
  }

  protected serviceDescription(service: BackendProfessionalDetailService): string {
    return service.description?.trim() || 'Service Jokko';
  }

  protected servicePrice(service: BackendProfessionalDetailService): number {
    const price = Number(service.prix);
    return Number.isFinite(price) && price > 0 ? price : this.fallbackServicePrice;
  }

  protected serviceIcon(service: BackendProfessionalDetailService): string {
    const name = this.serviceName(service).toLowerCase();
    if (name.includes('plomb')) return 'wrench';
    if (name.includes('elect')) return 'zap';
    if (name.includes('chauff')) return 'flame';
    if (name.includes('peint')) return 'paintbrush';
    return 'briefcase-business';
  }

  getAddressInputElement(): HTMLInputElement | null {
    return this.interactiveMap?.getSearchInputElement() ?? null;
  }

  protected selectService(serviceId: string): void {
    this.serviceSelected.emit(serviceId);
    this.close.emit();
  }

  protected openCustomServiceCreation(): void {
    this.customServiceName = '';
    this.isCreatingCustomService = true;
  }

  protected closeCustomServiceCreation(): void {
    this.isCreatingCustomService = false;
  }

  protected createCustomService(): void {
    const name = this.customServiceName.trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 200) return;

    this.customServiceCreated.emit(name);
    this.close.emit();
  }

  protected saveAddress(): void {
    if (!this.address.trim()) {
      this.addressChanged.emit("Adresse d'intervention non fournie");
    }
    this.close.emit();
  }
}
