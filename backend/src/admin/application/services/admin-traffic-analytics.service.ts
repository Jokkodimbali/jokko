import { Injectable } from '@nestjs/common';

type PlatformKey = 'web' | 'ios' | 'android';

export type AdminTrafficSession = {
  creeLe: Date;
  plateforme: string | null;
  utilisateurId: string;
};

@Injectable()
export class AdminTrafficAnalyticsService {
  buildPlatformTotals(sessions: AdminTrafficSession[]) {
    const usersByPlatform = this.createPlatformUserSets();

    for (const session of sessions) {
      usersByPlatform[this.normalizePlatform(session.plateforme)].add(
        session.utilisateurId,
      );
    }

    const totals: Record<PlatformKey, number> = {
      web: usersByPlatform.web.size,
      ios: usersByPlatform.ios.size,
      android: usersByPlatform.android.size,
    };

    return { ...totals, total: totals.web + totals.ios + totals.android };
  }

  buildTrafficSeries(sessions: AdminTrafficSession[], startDate: Date) {
    const rows = this.createSevenDayRows(startDate);

    for (const session of sessions) {
      const index = Math.floor(
        (session.creeLe.getTime() - startDate.getTime()) / 86_400_000,
      );
      if (index < 0 || index > 6) continue;
      rows[index].users[this.normalizePlatform(session.plateforme)].add(
        session.utilisateurId,
      );
    }

    return rows.map(({ label, users }) => ({
      label,
      web: users.web.size,
      ios: users.ios.size,
      android: users.android.size,
    }));
  }

  private normalizePlatform(platform: string | null): PlatformKey {
    return platform === 'ios' || platform === 'android' ? platform : 'web';
  }

  private createSevenDayRows(startDate: Date) {
    const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        label: labels[date.getDay() === 0 ? 6 : date.getDay() - 1],
        users: this.createPlatformUserSets(),
      };
    });
  }

  private createPlatformUserSets(): Record<PlatformKey, Set<string>> {
    return {
      web: new Set<string>(),
      ios: new Set<string>(),
      android: new Set<string>(),
    };
  }
}
