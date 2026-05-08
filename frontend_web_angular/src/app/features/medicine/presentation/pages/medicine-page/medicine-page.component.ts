import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppScrollHintComponent } from '../../../../../shared/ui/app-scroll-hint/app-scroll-hint.component';
import { MedicineService } from '../../../data-access/medicine.service';
import { MEDICINE_FILTERS } from '../../../domain/medicine.mock';
import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';
import { DoctorProfile } from '../../../domain/models/medicine.models';
import { DoctorCardComponent } from '../../components/doctor-card/doctor-card.component';
import { MedicineFilterBarComponent } from '../../components/medicine-filter-bar/medicine-filter-bar.component';
import { MedicineHeroComponent } from '../../components/medicine-hero/medicine-hero.component';

@Component({
  selector: 'app-medicine-page',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppScrollHintComponent,
    DoctorCardComponent,
    LucideAngularModule,
    MedicineFilterBarComponent,
    MedicineHeroComponent,
  ],
  templateUrl: './medicine-page.component.html',
  styleUrl: './medicine-page.component.scss',
})
export class MedicinePageComponent implements OnInit {
  private readonly medicineService = inject(MedicineService);

  protected readonly messages = MEDICINE_UI_MESSAGES;
  protected readonly filters = MEDICINE_FILTERS;
  protected readonly doctors = signal<DoctorProfile[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadDoctors();
  }

  private loadDoctors(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.medicineService.listDoctors().subscribe({
      next: ({ doctors }) => {
        this.doctors.set(doctors);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger les medecins pour le moment.');
        this.isLoading.set(false);
      },
    });
  }
}
