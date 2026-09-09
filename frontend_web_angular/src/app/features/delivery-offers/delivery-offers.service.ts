import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ApiResponse } from '../../core/http/api-response.models';
import { unwrapApiResponse } from '../../core/http/api-response.utils';
import { environment } from '../../../environments/environment';
import { MessagesRealtimeService } from '../messages/data-access/messages-realtime.service';

export interface DeliveryOffer {
  id: string;
  orderId: string;
  kind: 'PHARMACY' | 'MATERIAL';
  storeName: string;
  avatarUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class DeliveryOffersService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthSessionService);
  private readonly realtime = inject(MessagesRealtimeService);
  private readonly refresh = new Subject<void>();
  private readonly removed = new Set<string>();
  readonly offers = signal<DeliveryOffer[]>([]);
  readonly current = computed(() => this.offers()[0] ?? null);
  readonly unavailable = signal(false);

  constructor() {
    this.realtime.deliveryOfferResolved$.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.orderId) this.removed.add(event.orderId);
      if (event.notificationId) this.removed.add(event.notificationId);
      this.offers.update((offers) => this.filter(offers));
      this.refresh.next();
    });
    toObservable(this.auth.currentUser)
      .pipe(
        map((user) => user?.id ?? null),
        distinctUntilChanged(),
        switchMap((userId) => {
          this.offers.set([]);
          this.removed.clear();
          if (!userId) return of([] as DeliveryOffer[]);
          return merge(timer(0, 5000), this.realtime.notificationCreated$, this.refresh).pipe(
            switchMap(() =>
              this.http
                .get<
                  ApiResponse<DeliveryOffer[]>
                >(`${environment.apiUrl}/notifications/delivery-offers`)
                .pipe(
                  map(unwrapApiResponse),
                  catchError(() => {
                    this.unavailable.set(true);
                    return EMPTY;
                  }),
                ),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((offers) => {
        this.unavailable.set(false);
        this.offers.set(this.filter(offers));
      });
  }

  reload(): void {
    this.refresh.next();
  }

  remove(offer: DeliveryOffer): void {
    this.removed.add(offer.orderId);
    this.offers.update((offers) => this.filter(offers));
  }

  decline(offer: DeliveryOffer) {
    return this.http.post<ApiResponse<null>>(
      `${environment.apiUrl}/notifications/${offer.id}/delivery-offer/decline`,
      {},
    );
  }

  private filter(offers: DeliveryOffer[]): DeliveryOffer[] {
    return offers.filter(
      (offer) => !this.removed.has(offer.id) && !this.removed.has(offer.orderId),
    );
  }
}
