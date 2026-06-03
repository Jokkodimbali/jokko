import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type DoctorSpaceSection =
  | 'availability'
  | 'consultation'
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
  @Input({ required: true }) activeSection: DoctorSpaceSection = 'availability';
  @Input({ required: true }) ariaLabel = 'Navigation de l espace professionnel';
  @Input() showConsultationSection = true;

  @Output() readonly backRequested = new EventEmitter<void>();
  @Output() readonly sectionSelected = new EventEmitter<DoctorSpaceSection>();
}
