import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export interface AppSearchCategorySuggestion {
  id: string;
  name: string;
  count: number;
  icon?: string;
}

export interface AppSearchProviderSuggestion {
  id: string;
  name: string;
  category: string;
  profession: string;
  location: string;
  rating: number;
  totalReviews: number;
  isOnline: boolean;
  avatarUrl?: string | null;
  initials: string;
}

export interface AppSearchModeOption {
  value: string;
  label: string;
  icon?: string;
  imageUrl?: string;
  tone?: 'all' | 'client' | 'route' | 'provider';
}

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './app-search-bar.component.html',
  styleUrl: './app-search-bar.component.scss',
})
export class AppSearchBarComponent {
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  @Input() ariaLabel = 'Recherche';
  @Input() locationTitle = 'Localisation';
  @Input() locationValue = 'Toute zone';
  @Input() placeholder = 'Recherche';
  @Input() filterLabel = 'Filtrage';
  @Input() variant: 'default' | 'compact' | 'service' = 'default';
  @Input() filterValueLabel = '';
  @Input() locationOptions: string[] = [];
  @Input() categorySuggestions: AppSearchCategorySuggestion[] = [];
  @Input() providerSuggestions: AppSearchProviderSuggestion[] = [];
  @Input() modeOptions: AppSearchModeOption[] = [];
  @Input() selectedMode = '';
  @Input() resultsNearLabel = '';
  @Input() showSuggestions = false;
  @Input() showLocationMenu = false;

  private searchValue = '';
  protected showAllCategories = false;
  private readonly collapsedCategoryCount = 3;

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
  @Output() inputFocus = new EventEmitter<void>();
  @Output() locationClick = new EventEmitter<void>();
  @Output() locationOptionSelect = new EventEmitter<string>();
  @Output() currentLocationSelect = new EventEmitter<void>();
  @Output() categorySelect = new EventEmitter<string>();
  @Output() providerSelect = new EventEmitter<string>();
  @Output() modeSelect = new EventEmitter<string>();
  @Output() suggestionsClose = new EventEmitter<void>();
  @Output() panelClose = new EventEmitter<void>();

  get isServiceVariant(): boolean {
    return this.variant === 'service';
  }

  get visibleCategorySuggestions(): AppSearchCategorySuggestion[] {
    return this.showAllCategories
      ? this.categorySuggestions
      : this.categorySuggestions.slice(0, this.collapsedCategoryCount);
  }

  get hasHiddenCategories(): boolean {
    return this.categorySuggestions.length > this.collapsedCategoryCount;
  }

  get hiddenCategoryCount(): number {
    return Math.max(0, this.categorySuggestions.length - this.collapsedCategoryCount);
  }

  protected reviewCountFillPercent(reviews: number): number {
    return Math.round(Math.min(100, Math.max(0, reviews) * 10));
  }

  onInput(value: string): void {
    this.searchValue = value;
    this.showAllCategories = false;
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

  onLocationClick(): void {
    this.locationClick.emit();
  }

  onFocus(): void {
    this.inputFocus.emit();
  }

  onModeSelect(mode: string): void {
    this.modeSelect.emit(mode);
  }

  toggleCategoryList(): void {
    this.showAllCategories = !this.showAllCategories;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isServiceVariant || (!this.showSuggestions && !this.showLocationMenu)) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.hostElement.nativeElement.contains(target)) {
      return;
    }

    this.showAllCategories = false;
    this.panelClose.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.isServiceVariant || (!this.showSuggestions && !this.showLocationMenu)) {
      return;
    }

    this.showAllCategories = false;
    this.panelClose.emit();
  }
}
