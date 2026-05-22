import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  AdminArchiveItem,
  AdminArchiveTab,
  AdminArchivesQuery,
  AdminArchivesReport,
} from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-archives-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-archives-panel.component.html',
  styleUrl: './admin-archives-panel.component.scss',
})
export class AdminArchivesPanelComponent {
  @Input() report: AdminArchivesReport | null = null;
  @Input() isLoading = false;
  @Output() pageChange = new EventEmitter<AdminArchivesQuery>();

  protected activeTab: AdminArchiveTab = 'transactions';
  protected searchTerm = '';
  private readonly pageSize = 10;

  protected readonly tabs: Array<{
    key: AdminArchiveTab;
    label: string;
    icon: string;
  }> = [
    { key: 'closedDisputes', label: 'Litiges clos', icon: 'scale' },
    { key: 'invoices', label: 'Factures emises', icon: 'file-text' },
    { key: 'transactions', label: 'Transaction', icon: 'file-text' },
  ];

  protected setTab(tab: AdminArchiveTab): void {
    this.activeTab = tab;
    this.searchTerm = '';
    this.pageChange.emit({ tab, limit: this.pageSize, offset: 0 });
  }

  protected resetPage(): void {
    this.pageChange.emit({
      tab: this.activeTab,
      limit: this.pageSize,
      offset: 0,
      search: this.searchTerm.trim() || undefined,
    });
  }

  protected activeRows(report: AdminArchivesReport): AdminArchiveItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    const rows = report[this.activeTab] ?? [];

    if (!term) return rows;

    return rows.filter((row) =>
      [
        row.reference,
        row.type,
        row.from,
        row.to,
        row.status,
        row.method,
        row.description,
        row.reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }

  protected visibleRows(report: AdminArchivesReport): AdminArchiveItem[] {
    return this.activeRows(report);
  }

  protected pageCount(report: AdminArchivesReport): number {
    return Math.max(1, Math.ceil(report.pagination.total / report.pagination.limit));
  }

  protected page(report: AdminArchivesReport): number {
    return Math.floor(report.pagination.offset / report.pagination.limit) + 1;
  }

  protected previousPage(report: AdminArchivesReport): void {
    if (this.page(report) <= 1) return;
    this.pageChange.emit({
      tab: this.activeTab,
      limit: report.pagination.limit,
      offset: Math.max(0, report.pagination.offset - report.pagination.limit),
      search: this.searchTerm.trim() || undefined,
    });
  }

  protected nextPage(report: AdminArchivesReport): void {
    if (this.page(report) >= this.pageCount(report)) return;
    this.pageChange.emit({
      tab: this.activeTab,
      limit: report.pagination.limit,
      offset: report.pagination.offset + report.pagination.limit,
      search: this.searchTerm.trim() || undefined,
    });
  }

  protected pageStart(report: AdminArchivesReport): number {
    return report.pagination.total === 0 ? 0 : report.pagination.offset + 1;
  }

  protected pageEnd(report: AdminArchivesReport): number {
    return Math.min(report.pagination.offset + report.pagination.limit, report.pagination.total);
  }

  protected tabCount(report: AdminArchivesReport, tab: AdminArchiveTab): number {
    return report[tab]?.length ?? 0;
  }

  protected formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected formatMoney(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0))} FCFA`;
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      RESOLU: 'Termine',
      REJETE: 'Rejete',
      SUCCES: 'Payee',
      REMBOURSE: 'Remboursee',
      EN_ATTENTE: 'En attente',
      ECHEC: 'Echec',
      TERMINE: 'Termine',
    };
    return labels[status] ?? this.humanize(status);
  }

  protected methodLabel(method: string | null): string {
    if (!method) return '-';
    const labels: Record<string, string> = {
      WAVE: 'Wave',
      ORANGE_MONEY: 'Orange money',
      CARTE: 'Carte Visa',
      CREDIT_ESCROW: 'Escrow',
      DEBIT_RETRAIT: 'Retrait',
      REMBOURSEMENT: 'Remboursement',
      COMMISSION: 'Commission',
      AJUSTEMENT: 'Ajustement',
    };
    return labels[method] ?? this.humanize(method);
  }

  protected exportRows(report: AdminArchivesReport): void {
    const rows = this.activeRows(report);
    const header = ['Ref', 'Date', 'Type', 'De', 'Vers', 'Montant', 'Commission', 'Statut'];
    const csvRows = [
      header,
      ...rows.map((row) => [
        row.reference,
        this.formatDate(row.date),
        row.type,
        row.from,
        row.to,
        String(row.amount),
        String(row.commission),
        this.statusLabel(row.status),
      ]),
    ];
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `archives-${this.activeTab}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected trackById(_: number, row: AdminArchiveItem): string {
    return row.id;
  }

  private humanize(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
