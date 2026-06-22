import { AdminTrafficAnalyticsService } from './admin-traffic-analytics.service';

describe('AdminTrafficAnalyticsService', () => {
  let service: AdminTrafficAnalyticsService;

  beforeEach(() => {
    service = new AdminTrafficAnalyticsService();
  });

  it('counts one user once per platform even after repeated logins and logouts', () => {
    const sessions = [
      session('client-1', 'web', '2026-05-20T08:00:00.000Z'),
      session('client-1', 'web', '2026-05-20T09:00:00.000Z'),
      session('client-1', 'web', '2026-05-20T10:00:00.000Z'),
      session('pro-1', 'web', '2026-05-20T11:00:00.000Z'),
      session('admin-1', 'ios', '2026-05-20T12:00:00.000Z'),
    ];

    expect(service.buildPlatformTotals(sessions)).toEqual({
      web: 2,
      ios: 1,
      android: 0,
      total: 3,
    });
  });

  it('counts one user once per day and per platform in the 7-day traffic chart', () => {
    const startDate = new Date('2026-05-18T00:00:00.000Z');
    const sessions = [
      session('client-1', 'web', '2026-05-18T08:00:00.000Z'),
      session('client-1', 'web', '2026-05-18T09:00:00.000Z'),
      session('client-1', 'web', '2026-05-19T08:00:00.000Z'),
      session('client-2', 'android', '2026-05-19T08:00:00.000Z'),
      session('client-2', 'android', '2026-05-19T09:00:00.000Z'),
    ];

    expect(service.buildTrafficSeries(sessions, startDate)).toEqual([
      { label: 'Lun', web: 1, ios: 0, android: 0 },
      { label: 'Mar', web: 1, ios: 0, android: 1 },
      { label: 'Mer', web: 0, ios: 0, android: 0 },
      { label: 'Jeu', web: 0, ios: 0, android: 0 },
      { label: 'Ven', web: 0, ios: 0, android: 0 },
      { label: 'Sam', web: 0, ios: 0, android: 0 },
      { label: 'Dim', web: 0, ios: 0, android: 0 },
    ]);
  });

  it('treats missing or unknown platforms as web traffic', () => {
    const sessions = [
      session('client-1', null, '2026-05-20T08:00:00.000Z'),
      session('client-2', 'desktop', '2026-05-20T09:00:00.000Z'),
      session('client-3', 'ios', '2026-05-20T10:00:00.000Z'),
    ];

    expect(service.buildPlatformTotals(sessions)).toEqual({
      web: 2,
      ios: 1,
      android: 0,
      total: 3,
    });
  });
});

function session(
  utilisateurId: string,
  plateforme: string | null,
  creeLe: string,
) {
  return {
    utilisateurId,
    plateforme,
    creeLe: new Date(creeLe),
  };
}
