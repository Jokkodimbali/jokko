import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AuthService } from '../../../data-access/auth.service';
import { AUTH_UI_MESSAGES } from '../../../domain/auth-ui.messages';
import { AUTH_VALIDATORS } from '../../../domain/auth.validators';
import { VerifyOtpRequestDto } from '../../../domain/models/auth.models';

@Component({
  selector: 'app-otp-verify',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './otp-verify.component.html',
})
export class OtpVerifyComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isLoading = signal(false);
  isResending = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  phoneNumber = signal<string | null>(null);
  protected readonly messages = AUTH_UI_MESSAGES;

  otpForm = this.fb.nonNullable.group({
    code: ['', AUTH_VALIDATORS.otpCode],
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['phone']) {
        this.phoneNumber.set(params['phone']);
      } else {
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
    this.successMessage.set(null);

    const payload: VerifyOtpRequestDto = {
      phoneNumber: this.phoneNumber()!,
      code: this.otpForm.getRawValue().code,
    };

    this.authService
      .verifyOtp(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.authSession.saveAuthResponse(response);
          this.router.navigate(['/']);
        },
        error: (error: unknown) => {
          this.errorMessage.set(getHttpErrorMessage(error, AUTH_UI_MESSAGES.otpInvalid));
        },
      });
  }

  resendOtp(): void {
    if (!this.phoneNumber()) {
      this.errorMessage.set(AUTH_UI_MESSAGES.missingPhoneForOtp);
      return;
    }

    this.isResending.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService
      .sendOtp({ phoneNumber: this.phoneNumber()! })
      .pipe(finalize(() => this.isResending.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set(AUTH_UI_MESSAGES.otpResent);
        },
        error: (error: unknown) => {
          this.errorMessage.set(getHttpErrorMessage(error, AUTH_UI_MESSAGES.otpResendFailed));
        },
      });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.otpForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
