import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AdminRevenuePeriod,
  AdminRevenueReport,
  AdminRevenueSeriesPoint,
} from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-revenue-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-revenue-panel.component.html',
  styleUrl: './admin-revenue-panel.component.scss',
})
export class AdminRevenuePanelComponent {
  @Input() report: AdminRevenueReport | null = null;
  @Input() isLoading = false;
  @Output() periodChange = new EventEmitter<AdminRevenuePeriod>();

  protected readonly periods: Array<{ value: AdminRevenuePeriod; label: string }> = [
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
    { value: '90d', label: '90 jours' },
    { value: '12m', label: '12 mois' },
  ];

  protected selectPeriod(period: AdminRevenuePeriod): void {
    if (period === this.report?.period || this.isLoading) return;
    this.periodChange.emit(period);
  }

  protected chartMax(report: AdminRevenueReport): number {
    return Math.max(
      1,
      ...report.series.flatMap((point) => [
        Number(point.gross ?? 0),
        Number(point.net ?? 0),
        Number(point.commission ?? 0),
        Number(point.refunded ?? 0),
      ]),
    );
  }

  protected chartPointX(index: number, total: number): number {
    if (total <= 1) return 52;
    return 52 + (index * 656) / (total - 1);
  }

  protected chartPointY(value: number, report: AdminRevenueReport): number {
    return 248 - (Number(value || 0) / this.chartMax(report)) * 188;
  }

  protected linePoints(report: AdminRevenueReport, key: 'gross' | 'net' | 'commission' | 'refunded'): string {
    return report.series
      .map((point, index) => `${this.chartPointX(index, report.series.length)},${this.chartPointY(point[key] || 0, report)}`)
      .join(' ');
  }

  protected areaPoints(report: AdminRevenueReport, key: 'gross' | 'net'): string {
    if (report.series.length === 0) return '';
    const start = this.chartPointX(0, report.series.length);
    const end = this.chartPointX(report.series.length - 1, report.series.length);
    return `${start},248 ${this.linePoints(report, key)} ${end},248`;
  }

  protected chartTicks(report: AdminRevenueReport): number[] {
    const max = this.chartMax(report);
    return [max, max * 0.75, max * 0.5, max * 0.25, 0];
  }

  protected chartTickY(index: number): number {
    return 60 + index * 47;
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  protected formatCompact(value: number): string {
    const amount = Number(value || 0);
    if (amount >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)}M`;
    }
    if (amount >= 1_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount / 1_000)}K`;
    }
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  protected formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected bestPoint(report: AdminRevenueReport): AdminRevenueSeriesPoint | null {
    return report.series.reduce<AdminRevenueSeriesPoint | null>((best, point) => {
      if (!best) return point;
      return point.gross > best.gross ? point : best;
    }, null);
  }
}

