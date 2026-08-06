import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import {
  AdminReservationDetail,
  AdminReservationStatistics,
} from '../../../data-access/admin.models';
import { AdminReservationsService } from '../../../data-access/admin-reservations.service';

@Component({
  selector: 'app-admin-reservations-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-reservations-panel.component.html',
  styleUrl: './admin-reservations-panel.component.scss',
})
export class AdminReservationsPanelComponent implements OnInit {
  private readonly reservationsService = inject(AdminReservationsService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly pageSize = 10;
  protected readonly reservations = signal<AdminReservationDetail[]>([]);
  protected readonly totalReservations = signal(0);
  protected readonly page = signal(1);
  protected readonly statistics = signal<AdminReservationStatistics | null>(null);
  protected readonly selected = signal<AdminReservationDetail | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');
  protected startDate = '';
  protected endDate = '';
  protected status = '';
  protected search = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (!!this.startDate !== !!this.endDate) {
      const message = 'Selectionnez une date de debut et une date de fin pour filtrer la periode.';
      this.error.set(message);
      this.feedback.info(message);
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    const query = {
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      status: this.status || undefined,
      search: this.search.trim() || undefined,
      limit: this.pageSize,
      offset: (this.page() - 1) * this.pageSize,
    };
    forkJoin({
      reservations: this.reservationsService.list(query),
      statistics: this.reservationsService.statistics(query),
    })
      .pipe(
        catchError(() => {
          const message = 'Les reservations ne peuvent pas etre chargees pour le moment.';
          this.error.set(message);
          this.feedback.error(message);
          return of(null);
        }),
      )
      .subscribe((report) => {
        if (report) {
          this.reservations.set(report.reservations.items);
          this.totalReservations.set(report.reservations.pagination.total);
          this.statistics.set(report.statistics);
        }
        this.isLoading.set(false);
      });
  }

  protected open(reservationId: string): void {
    this.reservationsService
      .get(reservationId)
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de charger le detail de cette reservation.');
          return of(null);
        }),
      )
      .subscribe((reservation) => this.selected.set(reservation));
  }

  protected visibleReservations(): AdminReservationDetail[] {
    return this.reservations();
  }

  protected pageCount(): number {
    return Math.max(1, Math.ceil(this.totalReservations() / this.pageSize));
  }

  protected previousPage(): void {
    if (this.page() <= 1) return;
    this.page.update((page) => page - 1);
    this.load();
  }

  protected nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update((page) => page + 1);
    this.load();
  }

  protected pageStart(): number {
    return this.totalReservations() === 0 ? 0 : (this.page() - 1) * this.pageSize + 1;
  }

  protected pageEnd(): number {
    return Math.min(this.page() * this.pageSize, this.totalReservations());
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected statusEntries(
    stats: AdminReservationStatistics | null,
  ): Array<{ key: string; value: number }> {
    return Object.entries(stats?.byStatus ?? {}).map(([key, value]) => ({ key, value }));
  }

  protected money(value: number | null): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value ?? 0)} FCFA`;
  }

  protected date(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
}
