import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../data-access/auth.service';
import { LoginRequestDto } from '../../../domain/models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  loginForm = this.fb.nonNullable.group({
    phoneNumber: ['', [Validators.required, Validators.pattern('^\\+?[1-9]\\d{7,14}$')]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64)]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials: LoginRequestDto = this.loginForm.getRawValue();

    this.authService.login(credentials).subscribe({
      next: (response) => {
        // Here you would typically dispatch to a state manager or store the token
        localStorage.setItem('accessToken', response.accessToken);
        this.isLoading.set(false);
        this.router.navigate(['/']); // Navigate to dashboard
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Une erreur est survenue lors de la connexion.');
      }
    });
  }

  // Helper methods for template validation
  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
