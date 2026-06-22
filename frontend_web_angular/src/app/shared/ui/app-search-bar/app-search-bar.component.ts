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
  @Input() variant: 'default' | 'compact' = 'default';
  @Input() filterValueLabel = '';

  private searchValue = '';

  @Input()
  set value(value: string | null | undefined) {
    this.searchValue = value ?? '';
  }

  get value(): string {
    return this.searchValue;
  }

  @Output() valueChange = new EventEmitter<string>();
  @Output() searchSubmit = new EventEmitter<string>();
  @Output() filterClick = new EventEmitter<void>();

  onInput(value: string): void {
    this.searchValue = value;
    this.valueChange.emit(value);
  }

  onInputEvent(event: Event): void {
    this.onInput((event.target as HTMLInputElement | null)?.value ?? '');
  }

  onSubmit(): void {
    this.searchSubmit.emit(this.searchValue.trim());
  }

  onFilterClick(): void {
    this.filterClick.emit();
  }
}
