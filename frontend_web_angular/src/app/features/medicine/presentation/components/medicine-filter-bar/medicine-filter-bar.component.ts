import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MedicineFilterAction } from '../../../domain/models/medicine.models';

@Component({
  selector: 'app-medicine-filter-bar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './medicine-filter-bar.component.html',
  styleUrl: './medicine-filter-bar.component.scss',
})
export class MedicineFilterBarComponent {
  @Input({ required: true }) filters: MedicineFilterAction[] = [];
}
