import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './app-search-bar.component.html',
  styleUrl: './app-search-bar.component.scss',
})
export class AppSearchBarComponent {
  @Input() ariaLabel = 'Recherche';
  @Input() locationTitle = 'Localisation';
  @Input() locationValue = 'Dakar, SN';
  @Input() placeholder = 'Recherche';
  @Input() filterLabel = 'Filtrage';
  @Input() variant: 'default' | 'compact' = 'default';
}
