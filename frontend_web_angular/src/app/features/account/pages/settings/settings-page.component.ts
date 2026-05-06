import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AuthService } from '../../../auth/data-access/auth.service';
import { UserProfileDto } from '../../../auth/domain/models/auth.models';
import { AccountShellComponent } from '../../../../shared/ui/account-shell/account-shell.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AccountShellComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly authSession = inject(AuthSessionService);
  private readonly authService = inject(AuthService);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly profile = signal<UserProfileDto | null>(null);
  protected readonly isLoading = signal(false);

  ngOnInit(): void {
    if (!this.authSession.accessToken) return;

    this.isLoading.set(true);
    this.authService
      .me()
      .pipe(
        catchError(() => of(null)),
      )
      .subscribe((profile) => {
        this.profile.set(profile);
        this.isLoading.set(false);
      });
  }
}
