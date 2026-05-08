import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AppointmentStat } from '../../../domain/appointments.models';

@Component({
  selector: 'app-appointment-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointment-stats.component.html',
  styleUrl: './appointment-stats.component.scss',
})
export class AppointmentStatsComponent {
  @Input({ required: true }) stats: AppointmentStat[] = [];
}
