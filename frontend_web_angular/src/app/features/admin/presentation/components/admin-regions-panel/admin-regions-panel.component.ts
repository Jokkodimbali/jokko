import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AdminRegionRow, AdminRegionsReport } from '../../../data-access/admin.models';

type SenegalMapRegion = {
  name: string;
  labelX: number;
  labelY: number;
  points: string;
};

const SENEGAL_MAP_REGIONS: SenegalMapRegion[] = [
  {
    name: 'Saint-Louis',
    labelX: 255,
    labelY: 51,
    points: '165,18 318,20 338,65 279,88 191,78 151,51',
  },
  {
    name: 'Louga',
    labelX: 266,
    labelY: 117,
    points: '189,80 281,90 336,68 362,116 314,154 212,145 168,111',
  },
  {
    name: 'Matam',
    labelX: 433,
    labelY: 122,
    points: '364,72 486,92 558,139 501,174 394,159 363,118',
  },
  { name: 'Dakar', labelX: 75, labelY: 165, points: '44,137 98,137 112,176 76,204 35,182' },
  {
    name: 'Thies',
    labelX: 164,
    labelY: 184,
    points: '111,133 171,116 211,147 205,214 141,230 94,183',
  },
  { name: 'Diourbel', labelX: 269, labelY: 193, points: '214,148 315,156 342,206 296,255 209,216' },
  {
    name: 'Fatick',
    labelX: 206,
    labelY: 285,
    points: '143,233 210,219 286,263 271,336 175,332 123,291',
  },
  {
    name: 'Kaolack',
    labelX: 331,
    labelY: 304,
    points: '292,259 346,211 428,255 414,334 317,355 273,337',
  },
  { name: 'Kaffrine', labelX: 430, labelY: 230, points: '345,207 395,161 503,178 519,243 430,254' },
  {
    name: 'Tambacounda',
    labelX: 552,
    labelY: 296,
    points: '430,256 520,245 620,276 688,368 612,421 485,370 416,335',
  },
  {
    name: 'Kedougou',
    labelX: 612,
    labelY: 449,
    points: '486,373 613,424 696,371 726,470 641,530 532,495',
  },
  {
    name: 'Kolda',
    labelX: 416,
    labelY: 454,
    points: '290,387 402,344 483,373 529,497 408,506 301,465',
  },
  { name: 'Sedhiou', labelX: 243, labelY: 420, points: '151,365 286,388 297,463 189,472 101,428' },
  {
    name: 'Ziguinchor',
    labelX: 152,
    labelY: 514,
    points: '63,471 188,474 300,467 327,526 211,554 82,535',
  },
];

@Component({
  selector: 'app-admin-regions-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-regions-panel.component.html',
  styleUrl: './admin-regions-panel.component.scss',
})
export class AdminRegionsPanelComponent implements OnChanges {
  @Input() report: AdminRegionsReport | null = null;
  @Input() isLoading = false;

  protected readonly mapRegions = SENEGAL_MAP_REGIONS;
  protected selectedRegionName = 'Dakar';

  ngOnChanges(): void {
    if (!this.report) return;
    const currentExists = this.report.regions.some(
      (region) => region.name === this.selectedRegionName,
    );
    if (!currentExists || this.selectedRegionName === 'Dakar') {
      this.selectedRegionName = this.report.coverage.strongestRegion ?? 'Dakar';
    }
  }

  protected selectedRegion(report: AdminRegionsReport): AdminRegionRow | null {
    return (
      report.regions.find((region) => region.name === this.selectedRegionName) ??
      report.regions[0] ??
      null
    );
  }

  protected selectRegion(regionName: string): void {
    this.selectedRegionName = regionName;
  }

  protected mapRegionData(report: AdminRegionsReport, regionName: string): AdminRegionRow | null {
    return report.regions.find((region) => region.name === regionName) ?? null;
  }

  protected mapRegionClass(report: AdminRegionsReport, regionName: string): string {
    const region = this.mapRegionData(report, regionName);
    const activity = Number(region?.providers ?? 0) + Number(region?.clients ?? 0);
    if (activity === 0) return 'admin-senegal-map__region admin-senegal-map__region--empty';
    const ratio = activity / this.maxMapActivity(report);
    if (ratio >= 0.72) return 'admin-senegal-map__region admin-senegal-map__region--strong';
    if (ratio >= 0.35) return 'admin-senegal-map__region admin-senegal-map__region--medium';
    return 'admin-senegal-map__region admin-senegal-map__region--low';
  }

  protected mapRegionTitle(report: AdminRegionsReport, regionName: string): string {
    const region = this.mapRegionData(report, regionName);
    if (!region) return `${regionName} - aucune donnee`;
    return `${region.name} - ${this.formatNumber(region.providers)} prestataires, ${this.formatNumber(region.clients)} clients, ${this.formatMoney(region.grossRevenue)}`;
  }

  protected mapRegionActivity(report: AdminRegionsReport, regionName: string): number {
    const region = this.mapRegionData(report, regionName);
    return Number(region?.providers ?? 0) + Number(region?.clients ?? 0);
  }

  protected regionShare(region: AdminRegionRow, report: AdminRegionsReport): number {
    const total = Number(report.totals.providers || 0) + Number(report.totals.clients || 0);
    if (total <= 0) return 0;
    const activity = Number(region.providers || 0) + Number(region.clients || 0);
    return Math.round((activity / total) * 100);
  }

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
    return Math.max(
      4,
      Math.round((Number(region.grossRevenue || 0) / this.maxRevenue(report)) * 100),
    );
  }

  protected regionTrackBy(_: number, region: AdminRegionRow): string {
    return region.name;
  }

  private maxMapActivity(report: AdminRegionsReport): number {
    return Math.max(
      1,
      ...report.regions.map(
        (region) => Number(region.providers || 0) + Number(region.clients || 0),
      ),
    );
  }
}
