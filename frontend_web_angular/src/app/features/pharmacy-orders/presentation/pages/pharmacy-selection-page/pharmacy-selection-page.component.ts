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
import { NearbyPharmacyView, PharmacyOrdersService } from '../../../data-access/pharmacy-orders.service';

@Component({
  selector: 'app-pharmacy-selection-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppointmentTrackingStepperComponent],
  templateUrl: './pharmacy-selection-page.component.html',
  styleUrl: './pharmacy-selection-page.component.scss',
})
export class PharmacySelectionPageComponent implements AfterViewInit {
  @ViewChild('map') private mapElement?: ElementRef<HTMLElement>;

  private readonly orders = inject(PharmacyOrdersService);
  private readonly maps = inject(GoogleMapsLoaderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly markerElements = new Map<string, HTMLButtonElement>();

  protected readonly steps: AppointmentTrackingStep[] = [
    { label: 'Pharmacie', icon: 'circle', state: 'active' },
    { label: 'Ordonnance', icon: 'circle', state: 'pending' },
    { label: 'Paiement', icon: 'circle', state: 'pending' },
    { label: 'Livraison', icon: 'circle', state: 'pending' },
  ];
  protected readonly pharmacies = signal<NearbyPharmacyView[]>([]);
  protected readonly selected = signal<NearbyPharmacyView | null>(null);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly position = { latitude: 14.7167, longitude: -17.4677 };

  ngAfterViewInit(): void {
    // Start downloading Google Maps while the browser resolves the user's position.
    void this.maps.load().catch(() => undefined);
    if (!navigator.geolocation) {
      this.load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.position.latitude = position.coords.latitude;
        this.position.longitude = position.coords.longitude;
        this.load();
      },
      () => this.load(),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 1_200 },
    );
  }

  protected choose(pharmacy: NearbyPharmacyView): void {
    this.selected.set(pharmacy);
    this.syncMarkerSelection();
  }

  protected goBack(): void {
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');
    const fallback = reservationId ? `/appointments/${reservationId}` : '/appointments';
    this.backNavigation.back(this.route.snapshot.queryParamMap.get('returnUrl'), fallback, {
      preferReturnUrl: true,
    });
  }

  protected send(): void {
    const pharmacy = this.selected();
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');
    if (!pharmacy || !reservationId || this.sending()) return;

    this.sending.set(true);
    this.error.set(null);
    this.orders
      .create({ medicalReservationId: reservationId, pharmacyId: pharmacy.id })
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (order) => void this.router.navigate(['/pharmacy-orders', order.id]),
        error: () => this.error.set("Impossible d'envoyer l'ordonnance à cette pharmacie."),
      });
  }

  private load(): void {
    this.orders
      .listNearby(this.position)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: async (items) => {
          this.pharmacies.set(items);
          if (items.length > 0) this.selected.set(items[0]);
          await this.renderMap(items);
        },
        error: () => this.error.set('Impossible de charger les pharmacies proches.'),
      });
  }

  private async renderMap(items: NearbyPharmacyView[]): Promise<void> {
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
      for (const pharmacy of items) {
        const content = this.createPharmacyMarker(pharmacy);
        new Marker({
          map,
          position: { lat: pharmacy.latitude, lng: pharmacy.longitude },
          title: pharmacy.name,
          content,
          anchorLeft: '-50%',
          anchorTop: '-100%',
          zIndex: 20,
        });
        content.addEventListener('click', (event) => {
          event.stopPropagation();
          this.choose(pharmacy);
        });
        this.markerElements.set(pharmacy.id, content);
      }
      this.syncMarkerSelection();
    } catch {
      this.error.set('La carte est momentanément indisponible.');
    }
  }

  private createPharmacyMarker(pharmacy: NearbyPharmacyView): HTMLButtonElement {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.title = pharmacy.name;
    marker.setAttribute('aria-label', `Sélectionner ${pharmacy.name}`);
    marker.style.cssText = [
      'align-items:center',
      'background:transparent',
      'border:0',
      'cursor:pointer',
      'display:flex',
      'flex-direction:column',
      'font-family:Inter,Arial,sans-serif',
      'margin:0',
      'overflow:visible',
      'padding:0',
      'transform-origin:50% 100%',
      'transition:transform 160ms ease,filter 160ms ease',
    ].join(';');

    const icon = document.createElement('span');
    icon.dataset['markerIcon'] = 'true';
    icon.style.cssText = [
      'align-items:center',
      'background:#ffffff',
      'border:2px solid #20a05a',
      'border-radius:50%',
      'box-shadow:0 2px 7px rgba(16,24,40,.24)',
      'box-sizing:border-box',
      'display:flex',
      'height:38px',
      'justify-content:center',
      'overflow:hidden',
      'position:relative',
      'width:38px',
      'z-index:2',
    ].join(';');
    const image = document.createElement('img');
    image.src = '/pharmacy-map-marker.jpg';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.style.cssText = [
      'display:block',
      'height:32px',
      'object-fit:cover',
      'width:32px',
    ].join(';');
    icon.append(image);

    const label = document.createElement('span');
    label.dataset['markerLabel'] = 'true';
    label.textContent = pharmacy.name;
    label.style.cssText = [
      'background:#ff3b3f',
      'border:1.5px solid #ffffff',
      'border-radius:999px',
      'box-shadow:0 2px 5px rgba(16,24,40,.2)',
      'color:#ffffff',
      'font-size:10px',
      'font-weight:800',
      'line-height:1.15',
      'margin-top:-4px',
      'max-width:150px',
      'overflow:hidden',
      'padding:3px 7px',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'z-index:3',
    ].join(';');

    marker.append(icon, label);
    return marker;
  }

  private syncMarkerSelection(): void {
    const selectedId = this.selected()?.id;
    for (const [pharmacyId, marker] of this.markerElements) {
      const isSelected = pharmacyId === selectedId;
      marker.style.transform = isSelected ? 'scale(1.12)' : 'scale(1)';
      marker.style.filter = isSelected ? 'drop-shadow(0 3px 5px rgba(0,0,0,.18))' : 'none';
      marker.style.zIndex = isSelected ? '4' : '1';
      marker.setAttribute('aria-pressed', String(isSelected));
    }
  }
}
