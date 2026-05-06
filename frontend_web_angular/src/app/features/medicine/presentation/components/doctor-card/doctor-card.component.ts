import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DoctorProfile } from '../../../domain/models/medicine.models';
import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';

@Component({
  selector: 'app-doctor-card',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './doctor-card.component.html',
  styleUrl: './doctor-card.component.scss',
})
export class DoctorCardComponent {
  @Input({ required: true }) doctor!: DoctorProfile;

  protected readonly messages = MEDICINE_UI_MESSAGES;
}
