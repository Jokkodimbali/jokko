import { describe, expect, it } from 'vitest';
import { findFeaturedNotification, UserNotificationView } from './notifications.service';

function notification(
  id: string,
  type: string,
  reservationId: string,
  createdAt: string,
  isRead = true,
): UserNotificationView {
  return { id, type, data: { reservationId }, createdAt, isRead };
}

describe('findFeaturedNotification', () => {
  it('conserve une notification prestataire en route meme apres lecture', () => {
    const onTheWay = notification(
      'route-1',
      'PRESTATAIRE_EN_ROUTE',
      'reservation-1',
      '2026-08-17T09:00:00Z',
      true,
    );
    expect(findFeaturedNotification([onTheWay])).toBe(onTheWay);
  });

  it.each(['RESERVATION_FINALISEE', 'RESERVATION_ANNULEE'])(
    'retire la mise en avant apres %s pour la meme reservation',
    (terminalType) => {
      const onTheWay = notification(
        'route-1',
        'PRESTATAIRE_EN_ROUTE',
        'reservation-1',
        '2026-08-17T09:00:00Z',
      );
      const terminal = notification(
        'terminal-1',
        terminalType,
        'reservation-1',
        '2026-08-17T10:00:00Z',
      );
      expect(findFeaturedNotification([terminal, onTheWay])).toBeNull();
    },
  );

  it('ne termine pas le suivi a cause d une autre reservation', () => {
    const onTheWay = notification(
      'route-1',
      'PRESTATAIRE_EN_ROUTE',
      'reservation-1',
      '2026-08-17T09:00:00Z',
    );
    const terminal = notification(
      'terminal-2',
      'RESERVATION_FINALISEE',
      'reservation-2',
      '2026-08-17T10:00:00Z',
    );
    expect(findFeaturedNotification([terminal, onTheWay])).toBe(onTheWay);
  });

  it('conserve aussi la notification sur place apres lecture', () => {
    const arrived = {
      ...notification(
        'arrival-1',
        'PRESTATAIRE_EN_ROUTE',
        'reservation-1',
        '2026-08-17T10:00:00Z',
        true,
      ),
      data: {
        reservationId: 'reservation-1',
        tripStatus: 'SUR_PLACE',
        persistentUntilTerminal: true,
      },
    };
    expect(findFeaturedNotification([arrived])).toBe(arrived);
  });

  it('affiche sinon la premiere notification non lue', () => {
    const unread = notification(
      'offer-1',
      'AJUSTEMENT_PRIX_PROPOSE',
      'reservation-1',
      '2026-08-17T09:00:00Z',
      false,
    );
    expect(findFeaturedNotification([unread])).toBe(unread);
  });

  it.each([
    'RESERVATION_CONFIRMEE',
    'PAIEMENT_CONFIRME',
    'RESERVATION_ANNULEE',
    'RESERVATION_FINALISEE',
    'AJUSTEMENT_PRIX_REFUSE',
  ])('met en avant %s tant que la notification n est pas lue', (type) => {
    const unread = notification(
      `notification-${type}`,
      type,
      'reservation-1',
      '2026-08-18T10:00:00Z',
      false,
    );
    expect(findFeaturedNotification([unread])).toBe(unread);
  });
});
