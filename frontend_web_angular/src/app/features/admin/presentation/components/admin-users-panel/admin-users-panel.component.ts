import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { AdminUserHistory, AdminUserProfile, AdminUserRow } from '../../../data-access/admin.models';
import { AdminUsersService } from '../../../data-access/admin-users.service';

@Component({
  selector: 'app-admin-users-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-users-panel.component.html',
  styleUrl: './admin-users-panel.component.scss',
})
export class AdminUsersPanelComponent implements OnInit {
  private readonly usersService = inject(AdminUsersService);
  private readonly feedback = inject(AppFeedbackService);
  protected readonly pageSize = 10;
  protected readonly users = signal<AdminUserRow[]>([]);
  protected readonly page = signal(1);
  protected readonly canLoadNextPage = signal(false);
  protected readonly selectedUser = signal<AdminUserProfile | null>(null);
  protected readonly history = signal<AdminUserHistory | null>(null);
  protected readonly pendingActivation = signal<AdminUserProfile | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isDetailLoading = signal(false);
  protected readonly isActionLoading = signal(false);
  protected readonly error = signal('');
  protected search = '';
  protected role = '';
  protected active = '';

  ngOnInit(): void {
    this.loadUsers();
  }

  protected loadUsers(): void {
    this.isLoading.set(true);
    this.error.set('');
    this.usersService
      .list({
        search: this.search.trim() || undefined,
        role: this.role || undefined,
        isActive: this.active === '' ? undefined : this.active === 'true',
        limit: this.pageSize + 1,
        offset: (this.page() - 1) * this.pageSize,
      })
      .pipe(
        catchError(() => {
          const message = 'La liste des comptes ne peut pas etre actualisee pour le moment.';
          this.error.set(message);
          this.feedback.error(message);
          return of([]);
        }),
      )
      .subscribe((users) => {
        this.users.set(users.slice(0, this.pageSize));
        this.canLoadNextPage.set(users.length > this.pageSize);
        this.isLoading.set(false);
      });
  }

  protected applySearch(): void {
    this.page.set(1);
    this.loadUsers();
  }

  protected previousPage(): void {
    if (this.page() <= 1 || this.isLoading()) return;
    this.page.update((page) => page - 1);
    this.loadUsers();
  }

  protected nextPage(): void {
    if (!this.canLoadNextPage() || this.isLoading()) return;
    this.page.update((page) => page + 1);
    this.loadUsers();
  }

  protected openUser(userId: string): void {
    this.isDetailLoading.set(true);
    this.error.set('');
    forkJoin({
      user: this.usersService.get(userId),
      history: this.usersService.history(userId),
    })
      .pipe(
        catchError(() => {
          const message = 'Le dossier utilisateur demande est indisponible.';
          this.error.set(message);
          this.feedback.error(message);
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.selectedUser.set(result.user);
          this.history.set(result.history);
        }
        this.isDetailLoading.set(false);
      });
  }

  protected askActivation(user: AdminUserProfile): void {
    this.pendingActivation.set(user);
  }

  protected confirmActivation(): void {
    const user = this.pendingActivation();
    if (!user) return;
    this.isActionLoading.set(true);
    this.usersService
      .setActive(user.id, !user.estActif)
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de modifier le statut de ce compte.');
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (updated) {
          this.feedback.success(updated.estActif ? 'Compte active.' : 'Compte desactive.');
          this.selectedUser.set(updated);
          this.users.update((users) =>
            users.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
          );
        }
        this.pendingActivation.set(null);
        this.isActionLoading.set(false);
      });
  }

  protected closeDetail(): void {
    this.selectedUser.set(null);
    this.history.set(null);
  }

  protected initials(name: string): string {
    return userInitials(name);
  }

  protected formatMoney(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  protected formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
}
