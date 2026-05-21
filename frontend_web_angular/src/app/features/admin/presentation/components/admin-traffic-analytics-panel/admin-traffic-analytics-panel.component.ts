import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AdminDashboard, AdminPlatformMetric, AdminSeriesPoint } from '../../../data-access/admin.models';

type PlatformKey = 'web' | 'ios' | 'android';

@Component({
  selector: 'app-admin-traffic-analytics-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-traffic-analytics-panel.component.html',
  styleUrl: './admin-traffic-analytics-panel.component.scss',
})
export class AdminTrafficAnalyticsPanelComponent {
  @Input({ required: true }) data!: AdminDashboard;

  protected totalTraffic(): number {
    return this.data.overview.platforms.reduce((sum, platform) => sum + Number(platform.value ?? 0), 0);
  }

  protected activeUsers(): number {
    return this.data.users.active;
  }

  protected totalUsers(): number {
    return this.data.users.total;
  }

  protected activityRate(): number {
    return this.percentage(this.activeUsers(), this.totalUsers());
  }

  protected busiestDay(): AdminSeriesPoint | null {
    return this.data.overview.trafficSeries.reduce<AdminSeriesPoint | null>((best, point) => {
      if (!best) return point;
      return this.dayTotal(point) > this.dayTotal(best) ? point : best;
    }, null);
  }

  protected busiestDayTotal(): number {
    const day = this.busiestDay();
    return day ? this.dayTotal(day) : 0;
  }

  protected platformIcon(platform: AdminPlatformMetric): string {
    const icons: Record<string, string> = {
      web: 'globe-2',
      ios: 'apple',
      android: 'smartphone',
    };
    return icons[platform.key] ?? 'chart-no-axes-combined';
  }

  protected platformTone(platform: AdminPlatformMetric): string {
    const tones: Record<string, string> = {
      web: 'web',
      ios: 'ios',
      android: 'android',
    };
    return tones[platform.key] ?? 'web';
  }

  protected dayTotal(point: AdminSeriesPoint): number {
    return Number(point.web ?? 0) + Number(point.ios ?? 0) + Number(point.android ?? 0);
  }

  protected maxTraffic(): number {
    return Math.max(
      1,
      ...this.data.overview.trafficSeries.map((point) =>
        Math.max(Number(point.web ?? 0), Number(point.ios ?? 0), Number(point.android ?? 0)),
      ),
    );
  }

  protected barHeight(value: number | undefined): number {
    return Math.max(4, (Number(value ?? 0) / this.maxTraffic()) * 168);
  }

  protected platformTotal(key: PlatformKey): number {
    return this.data.overview.trafficSeries.reduce((sum, point) => sum + Number(point[key] ?? 0), 0);
  }

  protected platformShare(key: PlatformKey): number {
    return this.percentage(this.platformTotal(key), this.totalTraffic());
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  protected formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private percentage(value: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  }
}
