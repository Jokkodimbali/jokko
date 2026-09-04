import { describe, expect, it } from 'vitest';
import { FeaturedNotificationCacheService } from './featured-notification-cache.service';

describe('FeaturedNotificationCacheService', () => {
  it('memorise la fermeture temporaire sans supprimer la notification', () => {
    const cache = new FeaturedNotificationCacheService();

    expect(cache.isTransientDismissed('notification-terminee')).toBe(false);
    cache.dismissTransient('notification-terminee');
    expect(cache.isTransientDismissed('notification-terminee')).toBe(true);
  });

  it('restores an active trip notification after the navbar is recreated', () => {
    const cache = new FeaturedNotificationCacheService();
    const notification = {
      id: 'route-1',
      type: 'PRESTATAIRE_EN_ROUTE',
      title: 'Le client est en route',
      createdAt: '2026-08-21T10:00:00.000Z',
      isRead: true,
      data: { reservationId: 'reservation-1', persistentUntilTerminal: true },
    };

    cache.sync('user-1', [notification]);

    expect(cache.read('user-1')).toEqual(notification);
  });

  it('clears the cache when the same reservation is completed', () => {
    const cache = new FeaturedNotificationCacheService();
    const onTheWay = {
      id: 'route-1',
      type: 'PRESTATAIRE_EN_ROUTE',
      createdAt: '2026-08-21T10:00:00.000Z',
      data: { reservationId: 'reservation-1', persistentUntilTerminal: true },
    };
    const completed = {
      id: 'completed-1',
      type: 'RESERVATION_FINALISEE',
      createdAt: '2026-08-21T11:00:00.000Z',
      data: { reservationId: 'reservation-1' },
    };

    cache.sync('user-1', [onTheWay]);
    cache.sync('user-1', [completed, onTheWay]);

    expect(cache.read('user-1')).toBeNull();
  });

  it('restores a persistent pharmacy delivery offer after navbar recreation', () => {
    const cache = new FeaturedNotificationCacheService();
    const offer = {
      id: 'delivery-offer-1',
      type: 'NOUVELLE_RESERVATION',
      createdAt: '2026-09-04T10:00:00Z',
      isRead: true,
      data: { pharmacyOrderId: 'order-1', persistentDeliveryOffer: true },
    };

    cache.sync('courier-1', [offer]);

    expect(cache.read('courier-1')).toEqual(offer);
  });
});
