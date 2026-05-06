import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AppFooterComponent } from '../app-footer/app-footer.component';
import { AppNavbarComponent } from '../app-navbar/app-navbar.component';

@Component({
  selector: 'app-account-shell',
  standalone: true,
  imports: [CommonModule, AppFooterComponent, AppNavbarComponent],
  templateUrl: './account-shell.component.html',
  styleUrl: './account-shell.component.scss',
})
export class AccountShellComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
}
