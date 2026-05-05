import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../data-access/auth.service';
import { RegisterRequestDto } from '../../../domain/models/auth.models';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AUTH_UI_MESSAGES } from '../../../domain/auth-ui.messages';
import { AUTH_VALIDATORS } from '../../../domain/auth.validators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  protected readonly messages = AUTH_UI_MESSAGES;

  registerForm = this.fb.nonNullable.group({
    name: ['', AUTH_VALIDATORS.name],
    phoneNumber: ['', AUTH_VALIDATORS.phoneNumber],
    email: ['', [Validators.email]],
    password: ['', AUTH_VALIDATORS.password],
    role: ['CLIENT', [Validators.required]],
    adresse: ['', AUTH_VALIDATORS.address],
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
      email: formData.email ? formData.email : undefined,
    };

    this.authService
      .register(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.authSession.saveAuthResponse(response);
          this.router.navigate(['/']);
        },
        error: (error: unknown) => {
          this.errorMessage.set(getHttpErrorMessage(error, AUTH_UI_MESSAGES.registerFailed));
        },
      });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
