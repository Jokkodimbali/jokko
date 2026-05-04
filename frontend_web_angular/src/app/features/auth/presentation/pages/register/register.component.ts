import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../data-access/auth.service';
import { RegisterRequestDto } from '../../../domain/models/auth.models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    phoneNumber: ['', [Validators.required, Validators.pattern('^\\+?[1-9]\\d{7,14}$')]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64)]],
    role: ['CLIENT', [Validators.required]],
    adresse: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(255)]]
  });

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formData = this.registerForm.getRawValue();
    const payload: RegisterRequestDto = {
      ...formData,
      role: formData.role as 'CLIENT' | 'PRESTATAIRE',
      email: formData.email ? formData.email : undefined // Only send email if provided
    };

    this.authService.register(payload).subscribe({
      next: (response) => {
        localStorage.setItem('accessToken', response.accessToken);
        this.isLoading.set(false);
        // Maybe redirect to OTP verification or Dashboard depending on flow
        this.router.navigate(['/auth/verify-otp'], { queryParams: { phone: payload.phoneNumber } });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Une erreur est survenue lors de l\'inscription.');
      }
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
