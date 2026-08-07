import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AdminActivityItem,
  AdminCategoryMetric,
  AdminDashboard,
  AdminPlatformMetric,
  AdminSeriesPoint,
} from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-overview-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-overview-panel.component.html',
  styleUrl: './admin-overview-panel.component.scss',
})
export class AdminOverviewPanelComponent {
  @Input({ required: true }) data!: AdminDashboard;
  @Input() userName: string | null | undefined = null;

  protected readonly categoryColors = [
    '#d58a38',
    '#b95f34',
    '#86a361',
    '#9b8172',
    '#c96f48',
    '#6f8f77',
  ];

  protected formatMetric(value: number, unit?: string): string {
    if (unit === 'FCFA') {
      if (value >= 1_000_000) {
        return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`;
      }
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
    }

    if (value >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} Millions`;
    }

    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  protected formatCompact(value: number): string {
    if (value >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
    }
    if (value >= 1_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000)}K`;
    }
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  protected chartMax(
    series: AdminSeriesPoint[],
    keys: Array<'gross' | 'commission' | 'web' | 'ios' | 'android'>,
  ): number {
    return Math.max(1, ...series.flatMap((point) => keys.map((key) => Number(point[key] ?? 0))));
  }

  protected chartPointX(index: number, total: number): number {
    if (total <= 1) return 40;
    return 40 + (index * 500) / (total - 1);
  }

  protected chartPointY(
    value: number,
    series: AdminSeriesPoint[],
    keys: Array<'gross' | 'commission' | 'web' | 'ios' | 'android'>,
  ): number {
    return 150 - (Number(value || 0) / this.chartMax(series, keys)) * 112;
  }

  protected chartTicks(
    series: AdminSeriesPoint[],
    keys: Array<'gross' | 'commission' | 'web' | 'ios' | 'android'>,
  ): number[] {
    const max = this.chartMax(series, keys);
    return [max, max * 0.75, max * 0.5, max * 0.25, 0];
  }

  protected chartTickY(index: number): number {
    return 38 + index * 28;
  }

  protected linePoints(series: AdminSeriesPoint[], key: 'gross' | 'commission'): string {
    return series
      .map((point, index) => {
        const x = this.chartPointX(index, series.length);
        const y = this.chartPointY(Number(point[key] ?? 0), series, ['gross', 'commission']);
        return `${x},${y}`;
      })
      .join(' ');
  }

  protected areaPoints(series: AdminSeriesPoint[], key: 'gross' | 'commission'): string {
    if (series.length === 0) return '';
    const line = this.linePoints(series, key);
    const start = this.chartPointX(0, series.length);
    const end = this.chartPointX(series.length - 1, series.length);
    return `${start},150 ${line} ${end},150`;
  }

  protected barHeight(value: number, series: AdminSeriesPoint[]): number {
    return Math.max(
      2,
      (Number(value || 0) / this.chartMax(series, ['web', 'ios', 'android'])) * 118,
    );
  }

  protected categoryOffset(categories: AdminCategoryMetric[], index: number): number {
    return categories.slice(0, index).reduce((sum, category) => sum + category.share, 0);
  }

  protected categoryColor(index: number): string {
    return this.categoryColors[index % this.categoryColors.length];
  }

  protected platformIcon(platform: AdminPlatformMetric): string {
    if (platform.key === 'ios') return 'apple';
    if (platform.key === 'android') return 'smartphone';
    return 'globe-2';
  }

  protected activityDate(activity: AdminActivityItem): Date {
    return new Date(activity.timestamp);
  }
}
