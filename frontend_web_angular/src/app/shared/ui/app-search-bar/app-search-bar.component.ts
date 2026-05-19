import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() locationValue = 'Toute zone';
  @Input() placeholder = 'Recherche';
  @Input() filterLabel = 'Filtrage';
  @Input() value = '';
  @Input() variant: 'default' | 'compact' = 'default';

  @Output() valueChange = new EventEmitter<string>();
  @Output() searchSubmit = new EventEmitter<string>();

  onInput(value: string): void {
    this.valueChange.emit(value);
  }

  onSubmit(): void {
    this.searchSubmit.emit(this.value.trim());
  }
}
