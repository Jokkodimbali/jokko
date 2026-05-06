import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { AccountShellComponent } from '../../../shared/ui/account-shell/account-shell.component';

@Component({
  selector: 'app-simple-account-page',
  standalone: true,
  imports: [RouterLink, AccountShellComponent],
  template: `
    <app-account-shell [title]="title" [subtitle]="subtitle">
      <section class="simple-account-page">
        <h2>{{ emptyTitle }}</h2>
        <p>{{ emptyText }}</p>
        <a routerLink="/services">Retour aux services</a>
      </section>
    </app-account-shell>
  `,
  styles: [`
    .simple-account-page {
      align-items: center;
      background: #fff;
      border: 1px solid #dbe4ee;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 48px 24px;
      text-align: center;
    }

    .simple-account-page h2,
    .simple-account-page p {
      margin: 0;
    }

    .simple-account-page h2 {
      color: #172433;
      font-size: 26px;
      font-weight: 900;
    }

    .simple-account-page p {
      color: #64748b;
      font-weight: 700;
      max-width: 560px;
    }

    .simple-account-page a {
      background: #172433;
      border-radius: 10px;
      color: #fff;
      font-weight: 900;
      margin-top: 12px;
      padding: 14px 22px;
      text-decoration: none;
    }
  `],
})
export class SimpleAccountPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = this.route.snapshot.data;

  protected readonly title = String(this.routeData['title'] ?? '');
  protected readonly subtitle = String(this.routeData['subtitle'] ?? '');
  protected readonly emptyTitle = String(this.routeData['emptyTitle'] ?? '');
  protected readonly emptyText = String(this.routeData['emptyText'] ?? '');
}
