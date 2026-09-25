import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AppPresenceDotComponent } from '../app-presence-dot/app-presence-dot.component';

export interface AppSearchCategorySuggestion {
  id: string;
  name: string;
  count: number;
  icon?: string;
  emphasized?: boolean;
}

export interface AppSearchTextSuggestion {
  value: string;
  context?: string;
}

export interface AppSearchProviderSuggestion {
  id: string;
  userId?: string;
  name: string;
  speciality: string;
  location: string;
  isOnline: boolean;
  avatarUrl?: string | null;
  initials: string;
}

export interface AppSearchLocationFilter {
  sortBy: 'RATING' | 'DISTANCE';
  source: 'WRITTEN' | 'GPS';
  text: string;
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
  imports: [CommonModule, LucideAngularModule, AppPresenceDotComponent],
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
  @Input() textSuggestions: AppSearchTextSuggestion[] = [];
  @Input() providerSuggestions: AppSearchProviderSuggestion[] = [];
  @Input() modeOptions: AppSearchModeOption[] = [];
  @Input() selectedMode = '';
  @Input() resultsNearLabel = '';
  @Input() showSuggestions = false;
  @Input() showLocationMenu = false;

  private searchValue = '';
  protected showAllCategories = false;
  protected locationSort: 'RATING' | 'DISTANCE' = 'RATING';
  protected locationSource: 'WRITTEN' | 'GPS' = 'WRITTEN';
  protected writtenLocation = '';
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
  @Output() locationFilterApply = new EventEmitter<AppSearchLocationFilter>();
  @Output() categorySelect = new EventEmitter<string>();
  @Output() textSuggestionSelect = new EventEmitter<string>();
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

  onServiceSubmitClick(): void {
    this.onSubmit();
  }

  onTextSuggestionSelect(value: string): void {
    this.searchValue = value;
    this.textSuggestionSelect.emit(value);
  }

  suggestionPart(value: string, part: 'before' | 'match' | 'after'): string {
    const query = this.normalizeSearchText(this.searchValue.trim());
    const normalizedValue = this.normalizeSearchText(value);
    const matchIndex = normalizedValue.indexOf(query);
    if (!query || matchIndex < 0) {
      return part === 'before' ? value : '';
    }

    if (part === 'before') return value.slice(0, matchIndex);
    if (part === 'match') return value.slice(matchIndex, matchIndex + query.length);
    return value.slice(matchIndex + query.length);
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }

  onFilterClick(): void {
    this.filterClick.emit();
  }

  onLocationClick(): void {
    this.locationClick.emit();
  }

  selectLocationSort(sortBy: 'RATING' | 'DISTANCE'): void {
    this.locationSort = sortBy;
  }

  selectLocationSource(source: 'WRITTEN' | 'GPS'): void {
    this.locationSource = source;
  }

  onWrittenLocationInput(event: Event): void {
    this.writtenLocation = (event.target as HTMLInputElement | null)?.value ?? '';
    this.locationSource = 'WRITTEN';
  }

  applyLocationFilter(): void {
    this.locationFilterApply.emit({
      sortBy: this.locationSort,
      source: this.locationSource,
      text: this.writtenLocation.trim(),
    });
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
