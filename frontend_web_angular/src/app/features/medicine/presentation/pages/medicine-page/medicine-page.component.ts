import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  signal,
} from '@angular/core';
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
export class MedicinePageComponent implements AfterViewInit {
  @ViewChild('doctorList') private doctorList?: ElementRef<HTMLElement>;

  protected readonly messages = MEDICINE_UI_MESSAGES;
  protected readonly doctors = MEDICINE_DOCTORS;
  protected readonly filters = MEDICINE_FILTERS;
  protected readonly showScrollHint = signal(false);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.updateScrollHint());
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateScrollHint();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateScrollHint();
  }

  protected scrollToNextDoctor(): void {
    const list = this.doctorList?.nativeElement;
    if (!list) return;

    const cards = Array.from(list.querySelectorAll<HTMLElement>('app-doctor-card'));
    const nextCard = cards.find((card) => card.getBoundingClientRect().top > 120);
    (nextCard ?? list).scrollIntoView({ behavior: 'smooth', block: 'start' });

    window.setTimeout(() => this.updateScrollHint(), 450);
  }

  private updateScrollHint(): void {
    const list = this.doctorList?.nativeElement;
    if (!list) return;

    const rect = list.getBoundingClientRect();
    this.showScrollHint.set(rect.bottom > window.innerHeight + 80);
  }
}
