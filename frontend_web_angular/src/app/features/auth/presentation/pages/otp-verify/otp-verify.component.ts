import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../data-access/auth.service';
import { VerifyOtpRequestDto } from '../../../domain/models/auth.models';

@Component({
  selector: 'app-otp-verify',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './otp-verify.component.html'
})
export class OtpVerifyComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  phoneNumber = signal<string | null>(null);

  otpForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]{6}$')]]
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['phone']) {
        this.phoneNumber.set(params['phone']);
      } else {
        // Redirect to login if no phone number in params
        this.router.navigate(['/auth/login']);
      }
    });
  }

  onSubmit(): void {
    if (this.otpForm.invalid || !this.phoneNumber()) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const payload: VerifyOtpRequestDto = {
      phoneNumber: this.phoneNumber()!,
      code: this.otpForm.getRawValue().code
    };

    this.authService.verifyOtp(payload).subscribe({
      next: (response) => {
        localStorage.setItem('accessToken', response.accessToken);
        this.isLoading.set(false);
        this.router.navigate(['/']); // Go to dashboard
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Code OTP invalide ou expiré.');
      }
    });
  }

  resendOtp(): void {
    if (!this.phoneNumber()) return;
    
    // Set a generic loading state or add a specific one for resend
    this.authService.sendOtp({ phoneNumber: this.phoneNumber()! }).subscribe({
      next: () => {
        // Show success toast here
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Erreur lors du renvoi du code.');
      }
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.otpForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
