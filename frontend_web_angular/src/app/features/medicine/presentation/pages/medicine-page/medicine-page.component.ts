import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { MEDICINE_DOCTORS, MEDICINE_FILTERS } from '../../../domain/medicine.mock';
import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';
import { DoctorCardComponent } from '../../components/doctor-card/doctor-card.component';
import { MedicineFilterBarComponent } from '../../components/medicine-filter-bar/medicine-filter-bar.component';
import { MedicineHeroComponent } from '../../components/medicine-hero/medicine-hero.component';

@Component({
  selector: 'app-medicine-page',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    DoctorCardComponent,
    LucideAngularModule,
    MedicineFilterBarComponent,
    MedicineHeroComponent,
  ],
  templateUrl: './medicine-page.component.html',
  styleUrl: './medicine-page.component.scss',
})
export class MedicinePageComponent {
  protected readonly messages = MEDICINE_UI_MESSAGES;
  protected readonly doctors = MEDICINE_DOCTORS;
  protected readonly filters = MEDICINE_FILTERS;

}
