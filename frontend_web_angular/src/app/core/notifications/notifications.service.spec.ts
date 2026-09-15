import { describe, expect, it } from 'vitest';
import { findFeaturedNotification, formatNotificationTitle, notificationIcon, notificationAvatarUrl, notificationSubtitle, sortNotificationsNewestFirst, UserNotificationView } from './notifications.service';

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
    const notification = { id: 'transient', type, isRead: false };
    expect(findFeaturedNotification([notification])).toBe(notification);
    expect(findFeaturedNotification([notification], () => true)).toBeNull();
    expect(notification.isRead).toBe(false);
  });
  it('keeps a notification marked persistent until its reservation reaches a terminal state', () => {
    const enRoute: UserNotificationView = {
      id: 'en-route',
      type: 'PRESTATAIRE_EN_ROUTE',
      isRead: false,
      createdAt: '2026-09-08T10:00:00Z',
      data: { reservationId: 'r1', tripStatus: 'EN_ROUTE', persistentUntilTerminal: true },
    };
    const completed: UserNotificationView = {
      id: 'completed',
      type: 'RESERVATION_FINALISEE',
      isRead: true,
      createdAt: '2026-09-08T11:00:00Z',
      data: { reservationId: 'r1' },
    };

    expect(findFeaturedNotification([enRoute], () => true)).toBe(enRoute);
    expect(findFeaturedNotification([enRoute, completed])).toBeNull();
  });
  it('shows a newer message then restores the ongoing service', () => {
    const message = { id: 'message', type: 'MESSAGE_RECU', createdAt: '2026-09-08T11:00:00Z' };
    expect(findFeaturedNotification([ongoing, message])).toBe(message);
    expect(findFeaturedNotification([ongoing, message], id => id === 'message')).toBe(ongoing);
  });
  it('shows the most recent active service when several are permanent', () => {
    const latestOngoing = {
      id: 'ongoing-latest',
      type: 'PRESTATAIRE_EN_ROUTE',
      isRead: true,
      createdAt: '2026-09-08T12:00:00Z',
      data: { reservationId: 'r2', reservationStatus: 'EN_COURS' },
    };

    expect(findFeaturedNotification([ongoing, latestOngoing], () => true)).toBe(latestOngoing);
  });
  it('keeps the previous active service when the latest one is completed', () => {
    const latestOngoing = {
      id: 'ongoing-latest',
      type: 'PRESTATAIRE_EN_ROUTE',
      isRead: true,
      createdAt: '2026-09-08T12:00:00Z',
      data: { reservationId: 'r2', reservationStatus: 'EN_COURS' },
    };
    const completed = {
      id: 'completed-latest',
      type: 'RESERVATION_FINALISEE',
      createdAt: '2026-09-08T13:00:00Z',
      data: { reservationId: 'r2' },
    };

    expect(findFeaturedNotification([ongoing, latestOngoing, completed], () => true)).toBe(ongoing);
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
  it('uses the downward arrow when a proposed price is lower', () => {
    expect(notificationIcon({
      id: 'down',
      type: 'AJUSTEMENT_PRIX_PROPOSE',
      data: { previousAmount: 15000, proposedAmount: 12000 },
    })).toBe('move-down');
  });
  it('uses the upward arrow when a proposed price is higher', () => {
    expect(notificationIcon({
      id: 'up',
      type: 'AJUSTEMENT_PRIX_PROPOSE',
      data: { previousAmount: 12000, proposedAmount: 15000 },
    })).toBe('move-up');
  });
  it('does not invent an upward direction when historical prices are missing', () => {
    expect(notificationIcon({ id: 'legacy', type: 'AJUSTEMENT_PRIX_PROPOSE' })).toBe('banknote');
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
  it('uses a service motive or short instruction as the second line', () => {
    expect(notificationSubtitle({ id: 'n', type: 'RESERVATION_CONFIRMEE', body: 'Votre reservation est confirmee.', data: { serviceName: 'Consultation générale' } })).toBe('Consultation générale');
    expect(notificationSubtitle({ id: 'n', type: 'APPEL_MANQUE', body: 'Mamadou a tente de vous joindre.' })).toBe('Consultez vos appels');
    expect(notificationSubtitle({ id: 'n', type: 'AUTRE', body: 'Un texte long historique.' })).toBe('Voir la notification');
  });
  it('shows the reservation motive on the second line of a price adjustment', () => {
    expect(notificationSubtitle({
      id: 'adjustment',
      type: 'AJUSTEMENT_PRIX_PROPOSE',
      body: 'Le prestataire propose un nouveau prix.',
      data: {
        serviceName: 'Consultation générale',
        proposedPrice: 18000,
        reason: 'Intervention plus longue que prévu',
      },
    })).toBe('Consultation générale');
  });
  it('keeps the service motive out of the first line', () => {
    expect(formatNotificationTitle({
      id: 'n', type: 'PRESTATAIRE_EN_ROUTE', title: 'Livraison de médicaments acceptée',
      data: { serviceName: 'Livraison de médicaments', deliveryOfferResolved: true },
    })).toBe('Livraison acceptée');
  });
  it('tells a travelling client the professional destination', () => {
    expect(formatNotificationTitle({
      id: 'client-on-route',
      type: 'PRESTATAIRE_EN_ROUTE',
      data: {
        recipientIsTraveller: true,
        travellerRole: 'CLIENT',
        tripStatus: 'EN_ROUTE',
        targetName: 'Dr. Ndiaye',
      },
    })).toBe('Vous êtes en route vers Dr. Ndiaye');
  });
  it('labels wallet withdrawals and uses the wallet icon', () => {
    const withdrawal = {
      id: 'withdrawal',
      type: 'RETRAIT_EFFECTUE',
      data: { amount: 10000, walletDebit: true },
    };
    expect(formatNotificationTitle(withdrawal)).toBe('Votre wallet est débité de - 10 000 FCFA');
    expect(notificationIcon(withdrawal)).toBe('wallet-cards');
    expect(notificationSubtitle(withdrawal)).toBe('');
  });
  it('shows a wallet credit amount and the reservation motive', () => {
    const credit = {
      id: 'credit',
      type: 'PAIEMENT_LIBERE',
      data: { amount: 10000, walletCredit: true, serviceName: "Réparation fuite d'eau" },
    };
    expect(formatNotificationTitle(credit)).toBe('Votre wallet est crédité de + 10 000 FCFA');
    expect(notificationSubtitle(credit)).toBe("Réparation fuite d'eau");
  });
  it('always shows the reservation motive below a resolved dispute', () => {
    expect(notificationSubtitle({
      id: 'resolved-dispute',
      type: 'LITIGE_RESOLU',
      data: { serviceName: "Réparation fuite d'eau" },
    })).toBe("Réparation fuite d'eau");
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
