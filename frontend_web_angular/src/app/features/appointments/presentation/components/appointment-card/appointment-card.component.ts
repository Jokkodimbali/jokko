import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppointmentView } from '../../../domain/appointments.models';

@Component({
  selector: 'app-appointment-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './appointment-card.component.html',
  styleUrl: './appointment-card.component.scss',
})
export class AppointmentCardComponent {
  @Input({ required: true }) appointment!: AppointmentView;
}
