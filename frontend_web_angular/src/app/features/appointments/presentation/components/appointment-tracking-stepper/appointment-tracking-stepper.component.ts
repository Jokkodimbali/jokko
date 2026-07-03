import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type AppointmentTrackingStep = {
  label: string;
  description?: string;
  icon: string;
  state: 'done' | 'active' | 'pending';
};

@Component({
  selector: 'app-appointment-tracking-stepper',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './appointment-tracking-stepper.component.html',
  styleUrl: './appointment-tracking-stepper.component.scss',
})
export class AppointmentTrackingStepperComponent {
  @Input({ required: true }) steps: AppointmentTrackingStep[] = [];
  @Input() progress = 0;
  @Input() ariaLabel = 'Suivi de la reservation';
  @Input() providerMode = false;

  @Output() back = new EventEmitter<void>();
}
