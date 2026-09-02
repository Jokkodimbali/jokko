import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import {
  GoogleMapsLoaderService,
  GoogleMapsMapInstance,
} from '../../../../../shared/maps/google-maps-loader.service';
import {
  MaterialOrdersService,
  NearbyHardwareStore,
} from '../../../data-access/material-orders.service';

@Component({
  selector: 'app-hardware-store-selection-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppointmentTrackingStepperComponent],
  templateUrl: './hardware-store-selection-page.component.html',
  styleUrl: './hardware-store-selection-page.component.scss',
})
export class HardwareStoreSelectionPageComponent implements AfterViewInit {
  @ViewChild('map') private mapElement?: ElementRef<HTMLElement>;

  private readonly orders = inject(MaterialOrdersService);
  private readonly maps = inject(GoogleMapsLoaderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);

  protected readonly steps: AppointmentTrackingStep[] = [
    { label: 'Quincaillerie', icon: 'circle', state: 'active' },
    { label: 'Materiel', icon: 'circle', state: 'pending' },
    { label: 'Paiement', icon: 'circle', state: 'pending' },
    { label: 'Livraison', icon: 'circle', state: 'pending' },
  ];

  protected readonly stores = signal<NearbyHardwareStore[]>([]);
  protected readonly selected = signal<NearbyHardwareStore | null>(null);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly position = { latitude: 14.7167, longitude: -17.4677 };
  private readonly markerElements = new Map<string, HTMLButtonElement>();

  ngAfterViewInit(): void {
    void this.maps.load().catch(() => undefined);
    if (!navigator.geolocation) return this.load();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.position.latitude = position.coords.latitude;
        this.position.longitude = position.coords.longitude;
        this.load();
      },
      () => this.load(),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 1_500 },
    );
  }

  protected choose(store: NearbyHardwareStore): void {
    this.selected.set(store);
    this.syncMarkerSelection();
  }

  protected goBack(): void {
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');
    this.backNavigation.back(
      this.route.snapshot.queryParamMap.get('returnUrl'),
      reservationId ? `/appointments/${reservationId}` : '/appointments',
      { preferReturnUrl: true },
    );
  }

  protected send(): void {
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');
    const store = this.selected();
    if (!reservationId || !store || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.orders
      .create(reservationId, store.id)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (order) => void this.router.navigate(['/material-orders', order.id]),
        error: (error: { error?: { message?: string } }) =>
          this.error.set(
            error.error?.message ??
              "Impossible d'envoyer la liste de materiel a cette quincaillerie.",
          ),
      });
  }

  private load(): void {
    this.orders
      .listNearby(this.position)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: async (stores) => {
          this.stores.set(stores);
          this.selected.set(stores[0] ?? null);
          await this.renderMap(stores);
        },
        error: () => this.error.set('Impossible de charger les quincailleries proches.'),
      });
  }

  private async renderMap(stores: NearbyHardwareStore[]): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element) return;
    try {
      const google = await this.maps.load();
      const map = new google.maps.Map(element, {
        center: { lat: this.position.latitude, lng: this.position.longitude },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        mapId: google.mapId,
      }) as GoogleMapsMapInstance;
      const Marker = google.maps.marker?.AdvancedMarkerElement;
      if (!Marker) return;
      this.markerElements.clear();
      for (const store of stores) {
        const content = this.createHardwareStoreMarker(store);
        new Marker({
          map,
          position: { lat: store.latitude, lng: store.longitude },
          title: store.name,
          content,
          anchorLeft: '-50%',
          anchorTop: '-100%',
          zIndex: 20,
        });
        content.addEventListener('click', (event) => {
          event.stopPropagation();
          this.choose(store);
        });
        this.markerElements.set(store.id, content);
      }
      this.syncMarkerSelection();
      this.syncMarkerZoom(map);
      map.addListener('zoom_changed', () => this.syncMarkerZoom(map));
    } catch {
      this.error.set('La carte est momentanement indisponible.');
    }
  }

  private createHardwareStoreMarker(store: NearbyHardwareStore): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'hardware-map-marker';
    marker.title = store.name;
    marker.setAttribute('aria-label', `Selectionner ${store.name}`);

    const icon = document.createElement('span');
    icon.className = 'hardware-map-marker__icon';
    const image = document.createElement('img');
    image.src = '/hardware-store-map-marker.svg';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    icon.append(image);

    const label = document.createElement('span');
    label.className = 'hardware-map-marker__label';
    label.textContent = store.name;
    marker.append(icon, label);
    return marker;
  }

  private syncMarkerSelection(): void {
    const selectedId = this.selected()?.id;
    for (const [storeId, marker] of this.markerElements) {
      const isSelected = storeId === selectedId;
      marker.classList.toggle('is-selected', isSelected);
      marker.setAttribute('aria-pressed', String(isSelected));
    }
  }

  private syncMarkerZoom(map: GoogleMapsMapInstance): void {
    const zoom = map.getZoom?.() ?? 13;
    const scale = Math.min(1.35, Math.max(0.65, 0.76 + (zoom - 10) * 0.08));
    for (const marker of this.markerElements.values()) {
      marker.style.setProperty('--map-zoom-scale', scale.toFixed(2));
    }
  }
}
