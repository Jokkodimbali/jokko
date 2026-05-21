import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AdminRegionRow, AdminRegionsReport } from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-regions-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-regions-panel.component.html',
  styleUrl: './admin-regions-panel.component.scss',
})
export class AdminRegionsPanelComponent {
  @Input() report: AdminRegionsReport | null = null;
  @Input() isLoading = false;

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  protected formatMoney(value: number): string {
    const amount = Number(value || 0);
    if (amount >= 1_000_000) {
      return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} M FCFA`;
    }
    return `${this.formatNumber(amount)} FCFA`;
  }

  protected maxRevenue(report: AdminRegionsReport): number {
    return Math.max(1, ...report.regions.map((region) => Number(region.grossRevenue || 0)));
  }

  protected revenueWidth(region: AdminRegionRow, report: AdminRegionsReport): number {
    return Math.max(4, Math.round((Number(region.grossRevenue || 0) / this.maxRevenue(report)) * 100));
  }

  protected maxProviders(report: AdminRegionsReport): number {
    return Math.max(1, ...report.regions.map((region) => Number(region.providers || 0)));
  }

  protected providerHeight(region: AdminRegionRow, report: AdminRegionsReport): number {
    return Math.max(8, Math.round((Number(region.providers || 0) / this.maxProviders(report)) * 100));
  }

  protected regionTrackBy(_: number, region: AdminRegionRow): string {
    return region.name;
  }
}
