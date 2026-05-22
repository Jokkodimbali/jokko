import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';
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
          this.error.set('La liste des comptes ne peut pas etre actualisee pour le moment.');
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
          this.error.set('Le dossier utilisateur demande est indisponible.');
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
      .pipe(catchError(() => of(null)))
      .subscribe((updated) => {
        if (updated) {
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
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected formatMoney(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  protected formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
}
