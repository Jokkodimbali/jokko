import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type AppointmentTrackingStep = {
  label: string;
  description?: string;
  icon: string;
  state: 'done' | 'active' | 'pending';
};

const APPOINTMENT_JOURNEY_LABELS = [
  'Négociation prix',
  'Paiement',
  'Confirmé',
  'Suivi rendez-vous',
] as const;

export function appointmentJourneySteps(currentStep: 1 | 2 | 3 | 4): AppointmentTrackingStep[] {
  return APPOINTMENT_JOURNEY_LABELS.map((label, index) => ({
    label,
    icon: 'circle',
    state: index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'active' : 'pending',
  }));
}

export function appointmentJourneyProgress(currentStep: 1 | 2 | 3 | 4): number {
  return ((currentStep - 1) / (APPOINTMENT_JOURNEY_LABELS.length - 1)) * 82;
}

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
  @Input() showBack = true;
  @Input() embedded = false;
  @Input() hideLastStepContent = false;
  @Input() clickableStepIndexes: number[] = [];

  @Output() back = new EventEmitter<void>();
  @Output() stepSelected = new EventEmitter<number>();

  @HostBinding('class.appointment-tracking-stepper-host--embedded')
  protected get embeddedHost(): boolean {
    return this.embedded;
  }

  protected selectStep(index: number): void {
    if (this.clickableStepIndexes.includes(index)) {
      this.stepSelected.emit(index);
    }
  }
}
