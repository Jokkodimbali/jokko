import { firstValueFrom } from 'rxjs';
import { SenegalGeolocationService } from '../../../core/location/senegal-geolocation.service';
import { GoogleMapsLoaderService } from '../../../shared/maps/google-maps-loader.service';
import { normalizeSearchText } from '../../../shared/utils/normalize-search-text';
import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { ServicesService } from '../../services/data-access/services.service';
import { CategoryStructure } from '../../services/domain/models/services.models';
import {
  ServiceProposalInteractiveMapComponent,
  ServiceProposalMapAddressSelection,
} from '../../services/presentation/components/service-proposal-interactive-map/service-proposal-interactive-map.component';
import { TenderPriceControlComponent } from './tender-price-control.component';
import { CreateTender } from '../data-access/tenders.models';
import { TendersService } from '../data-access/tenders.service';

export type TenderAudience = {
  count: number;
  avatars: { name: string; avatarUrl: string | null }[];
};

@Component({
  selector: 'app-tender-composer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    ServiceProposalInteractiveMapComponent,
    TenderPriceControlComponent,
  ],
  templateUrl: './tender-composer.component.html',
  styleUrl: './tenders.shared.scss',
})
export class TenderComposerComponent {
  @Input() busy = false;
  @Output() readonly publish = new EventEmitter<CreateTender>();
  @Output() readonly audienceChange = new EventEmitter<TenderAudience | null>();
  private readonly tenders = inject(TendersService);
  private readonly destroyRef = inject(DestroyRef);
  private previewRequest = 0;
  private readonly geolocation = inject(SenegalGeolocationService);
  private readonly maps = inject(GoogleMapsLoaderService);
  protected locating = false;
  protected mapExpanded = false;
  private readonly catalog = inject(ServicesService);
  protected readonly categories = signal<CategoryStructure[]>([]);
  protected readonly query = signal('');
  protected readonly catalogError = signal('');
  protected readonly searchOpen = signal(false);
  protected highlightedSuggestion = -1;
  protected selected: { categoryId: string; subCategoryId?: string; label: string } | null = null;
  protected description = '';
  protected address = '';
  protected coordinate: { lat: number; lng: number } | null = null;
  protected price = 10000;
  protected when: 'ASAP' | 'PLANNED' = 'ASAP';
  protected date = '';
  protected time = '';
  protected error = '';
  protected readonly suggestions = computed(() => {
    const query = this.normalize(this.query());
    if (query.length < 2) return [];
    return this.categories()
      .flatMap((category) => [
        { id: category.id, name: category.nom },
        ...category.subCategories
          .filter((sub) => sub.estActive)
          .map((sub) => ({ id: `${category.id}:${sub.id}`, name: sub.nom })),
      ])
      .filter((item) => this.normalize(item.name).includes(query))
      .sort((a, b) => {
        const aStarts = this.normalize(a.name).startsWith(query);
        const bStarts = this.normalize(b.name).startsWith(query);
        return Number(bStarts) - Number(aStarts) || a.name.length - b.name.length;
      })
      .slice(0, 6);
  });
  constructor() {
    this.catalog
      .getCategoryStructure()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (categories) =>
          this.categories.set(
            categories.filter(
              (category) => category.estActive && category.typeEspace === 'PRESTATAIRE',
            ),
          ),
        error: () =>
          this.catalogError.set(
            'Le catalogue est indisponible. Actualisez la page pour réessayer.',
          ),
      });
  }
  private normalize(value: string) {
    return normalizeSearchText(value).trim();
  }
  protected search(value: string) {
    this.previewRequest++;
    this.query.set(value);
    this.selected = null;
    this.audienceChange.emit(null);
    this.searchOpen.set(true);
    this.highlightedSuggestion = -1;
  }
  protected clearSearch() {
    this.search('');
  }
  protected submitSearch() {
    const option = this.suggestions()[this.highlightedSuggestion] ?? this.suggestions()[0];
    if (option) this.choose(option.id);
    else this.searchOpen.set(true);
  }
  protected searchKeydown(event: KeyboardEvent) {
    const options = this.suggestions();
    if (event.key === 'Escape') {
      this.searchOpen.set(false);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.submitSearch();
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.highlightedSuggestion =
        this.highlightedSuggestion < 0
          ? direction > 0
            ? 0
            : options.length - 1
          : (this.highlightedSuggestion + direction + options.length) % options.length;
    }
  }
  protected closeSearchSoon() {
    setTimeout(() => this.searchOpen.set(false), 150);
  }
  protected choose(id: string) {
    const [categoryId, subCategoryId] = id.split(':');
    const category = this.categories().find((item) => item.id === categoryId);
    if (!category) return;
    const label = subCategoryId
      ? category.subCategories.find((item) => item.id === subCategoryId)?.nom
      : category.nom;
    if (!label) return;
    this.selected = { categoryId, subCategoryId, label };
    this.query.set(label);
    this.searchOpen.set(false);
    this.loadAudience();
  }
  protected dateChanged(value: string) {
    this.date = value;
    if (value) {
      this.when = 'PLANNED';
      this.time ||= '09:00';
    } else if (!this.time) {
      this.when = 'ASAP';
    }
  }
  protected timeChanged(value: string) {
    this.time = value;
    if (value) {
      this.when = 'PLANNED';
      this.date ||= this.localDate();
    } else if (!this.date) {
      this.when = 'ASAP';
    }
  }
  protected clearSchedule() {
    this.when = 'ASAP';
    this.date = '';
    this.time = '';
  }
  protected localDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  protected locate(selection: ServiceProposalMapAddressSelection) {
    this.address = selection.address;
    this.coordinate = { lat: selection.coordinate.latitude, lng: selection.coordinate.longitude };
    this.loadAudience();
  }
  protected addressEdited(address: string) {
    if (address !== this.address) {
      this.previewRequest++;
      this.coordinate = null;
      this.audienceChange.emit(null);
    }
    this.address = address;
  }
  private loadAudience() {
    const requestId = ++this.previewRequest;
    if (!this.selected || !this.coordinate) return;
    this.tenders
      .preview({
        categoryId: this.selected.categoryId,
        ...(this.selected.subCategoryId ? { subCategoryId: this.selected.subCategoryId } : {}),
        latitude: this.coordinate.lat,
        longitude: this.coordinate.lng,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (audience) => {
          if (requestId === this.previewRequest) this.audienceChange.emit(audience);
        },
        error: () => {
          if (requestId === this.previewRequest) this.audienceChange.emit(null);
        },
      });
  }
  protected async usePosition() {
    this.locating = true;
    this.error = '';
    try {
      const coordinate = await this.geolocation.getCurrentPosition();
      const result = await firstValueFrom(this.maps.reverseGeocode(coordinate)).catch(() => null);
      this.locate({
        address:
          result?.formattedAddress ??
          `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
        coordinate,
      });
    } catch {
      this.error =
        'Position indisponible. Autorisez la localisation ou recherchez une adresse sur la carte.';
    } finally {
      this.locating = false;
    }
  }
  protected submit() {
    this.error = '';
    if (this.busy) return;
    if (!this.selected) {
      this.error = 'Sélectionnez un métier dans les résultats de recherche.';
      return;
    }
    if (this.description.trim().length < 10) {
      this.error = 'Décrivez votre besoin en au moins 10 caractères.';
      return;
    }
    if (!this.coordinate || this.address.trim().length < 3 || this.address.trim().length > 180) {
      this.error = 'Choisissez une adresse sur la carte (180 caractères maximum).';
      return;
    }
    const scheduledAt = this.date && this.time ? new Date(`${this.date}T${this.time}`) : null;
    if (
      this.when === 'PLANNED' &&
      (!scheduledAt ||
        !Number.isFinite(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now())
    ) {
      this.error = 'Choisissez une date et une heure futures.';
      return;
    }
    this.publish.emit({
      categoryId: this.selected.categoryId,
      subCategoryId: this.selected.subCategoryId,
      description: this.description.trim(),
      address: this.address.trim(),
      latitude: this.coordinate.lat,
      longitude: this.coordinate.lng,
      proposedPrice: this.price,
      radiusKm: 25,
      ...(this.when === 'PLANNED' && scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
    });
  }
}
