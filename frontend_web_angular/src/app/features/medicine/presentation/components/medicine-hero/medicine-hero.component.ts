import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppSearchBarComponent } from '../../../../../shared/ui/app-search-bar/app-search-bar.component';
import { MEDICINE_UI_MESSAGES } from '../../../domain/medicine-ui.messages';

@Component({
  selector: 'app-medicine-hero',
  standalone: true,
  imports: [CommonModule, AppNavbarComponent, AppSearchBarComponent, LucideAngularModule],
  templateUrl: './medicine-hero.component.html',
  styleUrl: './medicine-hero.component.scss',
})
export class MedicineHeroComponent {
  protected readonly messages = MEDICINE_UI_MESSAGES;
}
