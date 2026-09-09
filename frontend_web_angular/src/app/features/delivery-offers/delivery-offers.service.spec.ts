import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { MessagesRealtimeService } from '../messages/data-access/messages-realtime.service';
import { DeliveryOffer, DeliveryOffersService } from './delivery-offers.service';

const offer: DeliveryOffer = {
  id: 'notice',
  orderId: 'order',
  kind: 'PHARMACY',
  storeName: 'Pharmacie Plateau',
  avatarUrl: null,
  address: 'Dakar Plateau',
  latitude: 14.67,
  longitude: -17.43,
  distanceKm: 0.78,
  createdAt: '2026-09-09T10:00:00Z',
};
function setup() {
  vi.useFakeTimers();
  const user = signal<{ id: string } | null>({ id: 'courier' });
  const resolved = new Subject<{ orderId?: string; notificationId?: string }>();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: { currentUser: user } },
      {
        provide: MessagesRealtimeService,
        useValue: { notificationCreated$: new Subject(), deliveryOfferResolved$: resolved },
      },
    ],
  });
  const service = TestBed.inject(DeliveryOffersService);
  const http = TestBed.inject(HttpTestingController);
  TestBed.tick();
  vi.advanceTimersByTime(0);
  http
    .expectOne((req) => req.url.endsWith('/delivery-offers'))
    .flush({ success: true, data: [offer] });
  return { service, http, user, resolved };
}
describe('delivery offers synchronization', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('persists beyond fifteen seconds and stops a resolved offer immediately, ignoring stale responses', () => {
    const { service, http, resolved } = setup();
    vi.advanceTimersByTime(20_000);
    const requests = http.match((req) => req.url.endsWith('/delivery-offers'));
    const pending = requests.at(-1)!;
    expect(service.current()?.id).toBe(offer.id);
    resolved.next({ orderId: offer.orderId });
    expect(service.current()).toBeNull();
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((req) => req.url.endsWith('/delivery-offers'))
      .flush({ success: true, data: [offer] });
    expect(service.current()).toBeNull();
  });
  it('records refusal only for the selected notification', () => {
    const { service, http } = setup();
    service.decline(offer).subscribe(() => service.remove(offer));
    const request = http.expectOne((req) => req.url.endsWith('/notice/delivery-offer/decline'));
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, data: null });
    expect(service.current()).toBeNull();
  });
  it('does not reset the card when the same user profile refreshes', () => {
    const { service, http, user } = setup();
    user.set({ id: 'courier' });
    TestBed.tick();
    expect(service.current()?.id).toBe(offer.id);
    http.expectNone((req) => req.url.endsWith('/delivery-offers'));
  });
  it('clears offers and cancels refreshes on logout', () => {
    const { service, http, user } = setup();
    user.set(null);
    TestBed.tick();
    vi.advanceTimersByTime(10_000);
    expect(service.current()).toBeNull();
    http.expectNone((req) => req.url.endsWith('/delivery-offers'));
  });
});
