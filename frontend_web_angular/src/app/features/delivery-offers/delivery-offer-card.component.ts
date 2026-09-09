import { MERCHANT_MAP_IMAGES } from '../../shared/maps/merchant-map-assets';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { AnimatedNotificationDisplay } from '../../core/notifications/notification-display';
import { NotificationAnchorService } from '../../shared/ui/notification-anchor.directive';
import { LocationMapComponent } from '../../shared/maps/location-map.component';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { finalize, map } from 'rxjs';
import { getHttpErrorMessage } from '../../core/http/api-response.utils';
import { PharmacyOrdersService } from '../pharmacy-orders/data-access/pharmacy-orders.service';
import { MaterialOrdersService } from '../material-orders/data-access/material-orders.service';
import { userInitials } from '../../shared/utils/user-initials';
import { DeliveryOffer, DeliveryOffersService } from './delivery-offers.service';
import { DeliveryOfferSoundService } from './delivery-offer-sound.service';

@Component({
  selector: 'app-delivery-offer-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, LocationMapComponent],
  providers: [DeliveryOfferSoundService],
  templateUrl: './delivery-offer-card.component.html',
  styleUrl: './delivery-offer-card.component.scss',
  host: {
    '[style.top.px]': 'position()?.top',
    '[style.right.px]': 'right()',
    '[style.visibility]': 'position() ? null : "hidden"',
  },
})
export class DeliveryOfferCardComponent {
  protected readonly mapImages = MERCHANT_MAP_IMAGES;
  protected readonly deliveries = inject(DeliveryOffersService);
  protected readonly sound = inject(DeliveryOfferSoundService);
  private readonly pharmacy = inject(PharmacyOrdersService);
  private readonly material = inject(MaterialOrdersService);
  private readonly router = inject(Router);
  private readonly anchor = inject(NotificationAnchorService);
  protected readonly position = this.anchor.position;
  protected readonly right = computed(() => {
    const anchor = this.position();
    return anchor
      ? Math.max(
          12,
          Math.min(
            anchor.right,
            anchor.viewportWidth - Math.min(290, anchor.viewportWidth - 24) - 12,
          ),
        )
      : 12;
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly display = new AnimatedNotificationDisplay<DeliveryOffer>(
    () => {},
    () => true,
  );
  protected readonly offer = this.display.notification;
  protected readonly leaving = computed(() => this.display.phase() === 'leaving');
  protected readonly entering = computed(() => this.display.phase() === 'entering');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly failedAvatar = signal<string | null>(null);
  protected readonly initials = computed(() => userInitials(this.offer()?.storeName));
  protected readonly distance = computed(() => {
    const km = this.offer()?.distanceKm;
    if (km == null || !Number.isFinite(km)) return 'Distance indisponible';
    return km < 1
      ? `${Math.round(km * 1000)} m`
      : `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
  });
  protected readonly minutes = computed(() => {
    const km = this.offer()?.distanceKm;
    return km != null && Number.isFinite(km) ? Math.max(1, Math.round((km / 25) * 60)) : null;
  });

  constructor() {
    effect(() => this.anchor.occupied.set(!!this.offer()));
    effect(() => {
      const next = this.deliveries.current();
      untracked(() => {
        if (next) this.sound.start();
        else this.sound.stop();
        if (this.offer()?.id !== next?.id) this.error.set('');
        this.display.update(next);
      });
    });
    this.destroyRef.onDestroy(() => { this.display.destroy(); this.anchor.occupied.set(false); });
  }

  protected accept(offer: DeliveryOffer): void {
    if (this.busy() || this.leaving()) return;
    this.busy.set(true);
    this.error.set('');
    const request =
      offer.kind === 'PHARMACY'
        ? this.pharmacy
            .acceptDelivery(offer.orderId)
            .pipe(map((order) => order.deliveryReservation?.id))
        : this.material
            .acceptDelivery(offer.orderId)
            .pipe(map((order) => order.deliveryReservation?.id));
    request
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reservationId) => {
          this.deliveries.remove(offer);
          if (reservationId) void this.router.navigate(['/appointments', reservationId]);
        },
        error: (error) => {
          this.error.set(getHttpErrorMessage(error, 'Impossible de prendre cette course.'));
          this.deliveries.reload();
        },
      });
  }

  protected decline(offer: DeliveryOffer): void {
    if (this.busy() || this.leaving()) return;
    this.busy.set(true);
    this.error.set('');
    this.deliveries
      .decline(offer)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.deliveries.remove(offer),
        error: (error) =>
          this.error.set(getHttpErrorMessage(error, 'Le refus n’a pas pu être enregistré.')),
      });
  }
}
