import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type DoctorSpaceSection =
  | 'profile'
  | 'availability'
  | 'consultation'
  | 'negotiations'
  | 'patient-appointments'
  | 'agenda'
  | 'medical-history'
  | 'wallet';

@Component({
  selector: 'app-doctor-space-sidebar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './doctor-space-sidebar.component.html',
  styleUrl: './doctor-space-sidebar.component.scss',
})
export class DoctorSpaceSidebarComponent {
  @Input({ required: true }) activeSection: DoctorSpaceSection | 'pharmacy' | 'hardware' =
    'availability';
  @Input({ required: true }) ariaLabel = 'Navigation de l espace professionnel';
  @Input() showConsultationSection = true;
  @Input() serviceSectionLabel = 'Services';
  @Input() agendaSectionLabel = 'Gestion RDV';
  @Input() appointmentHistorySectionLabel = 'Historique medical';
  @Input() showNegotiationsSection = false;
  @Input() showPatientAppointmentsSection = false;
  @Input() showPharmacySection = false;
  @Input() showHardwareStoreSection = false;

  @Output() readonly backRequested = new EventEmitter<void>();
  @Output() readonly sectionSelected = new EventEmitter<DoctorSpaceSection>();
  @Output() readonly pharmacyRequested = new EventEmitter<void>();
  @Output() readonly hardwareStoreRequested = new EventEmitter<void>();
}
