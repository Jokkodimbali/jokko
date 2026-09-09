import { describe, expect, it } from 'vitest';
import { findFeaturedNotification, formatNotificationTitle, notificationIcon, notificationAvatarUrl, sortNotificationsNewestFirst, UserNotificationView } from './notifications.service';

const ongoing: UserNotificationView = {
  id: 'ongoing', type: 'PRESTATAIRE_EN_ROUTE', isRead: true,
  createdAt: '2026-09-08T10:00:00Z',
  data: { reservationId: 'r1', reservationStatus: 'EN_COURS' },
};

describe('notification display lifecycle', () => {
  it('keeps the ongoing service visible after reading and transient dismissal', () => {
    expect(findFeaturedNotification([ongoing], () => true)).toBe(ongoing);
  });
  it.each(['RESERVATION_FINALISEE', 'RESERVATION_ANNULEE'])('ends persistence on %s for the same reservation', (type) => {
    const terminal = { id: 'end', type, isRead: true, createdAt: '2026-09-08T11:00:00Z', data: { reservationId: 'r1' } };
    expect(findFeaturedNotification([ongoing, terminal])).toBeNull();
    expect(findFeaturedNotification([ongoing, { ...terminal, data: { reservationId: 'r2' } }])).toBe(ongoing);
  });
  it.each(['MESSAGE_RECU', 'PRESTATAIRE_EN_ROUTE', 'NOUVELLE_RESERVATION', 'RESERVATION_FINALISEE'])('dismisses %s without marking it read', (type) => {
    const notification = { id: 'transient', type, isRead: false, data: { persistentUntilTerminal: true } };
    expect(findFeaturedNotification([notification])).toBe(notification);
    expect(findFeaturedNotification([notification], () => true)).toBeNull();
    expect(notification.isRead).toBe(false);
  });
  it('shows a newer message then restores the ongoing service', () => {
    const message = { id: 'message', type: 'MESSAGE_RECU', createdAt: '2026-09-08T11:00:00Z' };
    expect(findFeaturedNotification([ongoing, message])).toBe(message);
    expect(findFeaturedNotification([ongoing, message], id => id === 'message')).toBe(ongoing);
  });
});


describe('shared notification presentation', () => {
  it.each([
    ['APPEL_MANQUE', 'Appel manqué de Mamadou Dia', 'phone-missed'],
    ['APPEL_ENTRANT', 'Appel entrant de Mamadou Dia', 'phone-incoming'],
    ['RESERVATION_CONFIRMEE', 'Réservation confirmée avec Mamadou Dia', 'calendar-check'],
    ['RESERVATION_ANNULEE', 'Réservation annulée avec Mamadou Dia', 'calendar-x'],
    ['AJUSTEMENT_PRIX_PROPOSE', 'Ajustement de prix proposé par Mamadou Dia', 'banknote'],
    ['AJUSTEMENT_PRIX_ACCEPTE', 'Ajustement de prix accepté par Mamadou Dia', 'circle-check'],
    ['AJUSTEMENT_PRIX_REFUSE', 'Ajustement de prix refusé par Mamadou Dia', 'circle-x'],
  ])('identifies the person and event for %s', (type, title, icon) => {
    const notification = { id: 'n', type, data: { actorName: 'Mamadou Dia' } };
    expect(formatNotificationTitle(notification)).toBe(title);
    expect(notificationIcon(notification)).toBe(icon);
  });
  it('recovers the name in older missed-call messages', () => {
    expect(formatNotificationTitle({ id: 'n', type: 'APPEL_MANQUE', corps: 'Mamadou Dia a tente de vous joindre.' })).toBe('Appel manqué de Mamadou Dia');
  });
  it('preserves system notices without inventing a person', () => {
    expect(formatNotificationTitle({ id: 'n', type: 'ANNONCE_ADMIN', title: 'Maintenance prévue' })).toBe('Maintenance prévue');
  });
  it('does not duplicate names already present in other titles', () => {
    expect(formatNotificationTitle({ id: 'n', type: 'AUTRE', title: 'Mamadou Dia est en route', data: { actorName: 'Mamadou Dia' } })).toBe('Mamadou Dia est en route');
  });
  it('supports legacy avatar metadata', () => {
    expect(notificationAvatarUrl({ id: 'n', type: 'APPEL_MANQUE', donnees: { callerAvatarUrl: ' /avatar.png ' } })).toBe('/avatar.png');
  });
  it('sorts both date formats without mutating the input, with invalid dates last', () => {
    const old = { id: 'old', type: 'NOUVEAU_MESSAGE', createdAt: '2026-09-08T10:00:00Z' };
    const latest = { id: 'latest', type: 'APPEL_MANQUE', creeLe: '2026-09-08T11:00:00Z' };
    const invalid = { id: 'invalid', type: 'ANNONCE_ADMIN', createdAt: 'invalid' };
    const items = [old, invalid, latest];
    expect(sortNotificationsNewestFirst(items)).toEqual([latest, old, invalid]);
    expect(items).toEqual([old, invalid, latest]);
    expect(findFeaturedNotification(items)).toBe(latest);
    expect(findFeaturedNotification(items, id => id === latest.id)).toBeNull();
  });
});


describe('arrival persistence', () => {
  const arrived: UserNotificationView = {
    id: 'arrival', type: 'PRESTATAIRE_EN_ROUTE', isRead: true,
    createdAt: '2026-09-08T09:00:00Z',
    data: { reservationId: 'r1', tripStatus: 'SUR_PLACE', actorName: 'Mamadou' },
  };
  it('keeps the arrival visible without changing its wording or icon', () => {
    expect(findFeaturedNotification([arrived], () => true)).toBe(arrived);
    expect(formatNotificationTitle(arrived)).toBe('Mamadou est sur place');
    expect(notificationIcon(arrived)).toBe('pin');
  });
  it('replaces arrival with active work and clears both when the service finishes', () => {
    expect(findFeaturedNotification([arrived, ongoing])).toBe(ongoing);
    const end = { id: 'end', type: 'RESERVATION_FINALISEE', isRead: true,
      createdAt: '2026-09-08T11:00:00Z', data: { reservationId: 'r1' } };
    expect(findFeaturedNotification([arrived, ongoing, end])).toBeNull();
  });
});
