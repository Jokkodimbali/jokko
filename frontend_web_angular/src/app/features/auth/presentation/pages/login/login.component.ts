import { Component, ElementRef, NgZone, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { AuthService } from '../../../data-access/auth.service';
import { LoginRequestDto } from '../../../domain/models/auth.models';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { safeInternalUrl } from '../../../../../shared/utils/safe-internal-url';
import { AUTH_UI_MESSAGES } from '../../../domain/auth-ui.messages';
import {
  AUTH_VALIDATORS,
  SENEGAL_PHONE_DIAL_CODE,
  normalizeLoginIdentifier,
  toLoginIdentifierInput,
  toSenegalLocalPhoneInput,
} from '../../../domain/auth.validators';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly ngZone = inject(NgZone);

  @ViewChild('googleButton', { static: false })
  private readonly googleButton?: ElementRef<HTMLElement>;

  isLoading = signal(false);
  isGoogleLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  googleUnavailable = signal(true);
  protected readonly fontsReady = signal(false);
  private readonly rememberedLoginIdentifier = this.authSession.getRememberedLoginIdentifier();
  protected readonly messages = AUTH_UI_MESSAGES;
  protected readonly googleClientId = environment.googleClientId;
  protected readonly senegalDialCode = SENEGAL_PHONE_DIAL_CODE;

  loginForm = this.fb.nonNullable.group({
    identifier: [
      toLoginIdentifierInput(this.rememberedLoginIdentifier),
      AUTH_VALIDATORS.loginIdentifier,
    ],
    password: ['', AUTH_VALIDATORS.password],
    rememberMe: [this.authSession.isRememberMeEnabled()],
  });

  ngOnInit(): void {
    // Do not show the login with the browser fallback font first. On a hard
    // refresh it could look bold for a moment before Inter replaced it.
    if (!('fonts' in document)) {
      this.fontsReady.set(true);
      return;
    }

    void Promise.all([
      document.fonts.load('400 16px Inter'),
      document.fonts.load('500 16px Inter'),
      document.fonts.load('600 16px Inter'),
    ])
      .catch(() => undefined)
      .then(() => this.fontsReady.set(true));
  }

  onSubmit(): void {
    this.normalizeIdentifierDisplayControl();
    this.normalizePasswordControl();

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formData = this.loginForm.getRawValue();
    const credentials: LoginRequestDto = {
      identifier: normalizeLoginIdentifier(formData.identifier),
      password: formData.password,
    };

    this.authService
      .login(credentials)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.authSession.saveAuthResponse(response, formData.rememberMe);
          if (formData.rememberMe) {
            this.authSession.saveRememberedLoginIdentifier(credentials.identifier);
          } else {
            this.authSession.forgetRememberedLoginIdentifier();
          }
          this.feedback.success(AUTH_UI_MESSAGES.loginSuccess);
          this.navigateAfterLogin();
        },
        error: (error: unknown) => {
          this.errorMessage.set(getHttpErrorMessage(error, AUTH_UI_MESSAGES.loginFailed));
        },
      });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  protected onPhoneInput(): void {
    const control = this.loginForm.controls.identifier;
    if (!this.looksLikePhone(control.value)) {
      return;
    }

    const normalized = toSenegalLocalPhoneInput(control.value);

    if (normalized !== control.value) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  protected onPhoneBlur(): void {
    this.normalizeIdentifierDisplayControl();
  }

  protected isPhoneIdentifier(): boolean {
    return this.looksLikePhone(this.loginForm.controls.identifier.value);
  }

  protected startGoogleSignIn(): void {
    if (!this.googleClientId) {
      this.errorMessage.set(
        'Connexion Google indisponible : ajoutez le Web Client ID Google dans les environnements frontend et backend.',
      );
      return;
    }

    if (this.isLocalhostGoogleOrigin()) {
      this.errorMessage.set(
        'Connexion Google indisponible en local : ajoutez http://localhost:4200 dans les origines autorisees du client OAuth Google, puis rechargez la page.',
      );
      return;
    }

    this.googleUnavailable.set(false);
    this.initializeGoogleSignIn();
  }

  private initializeGoogleSignIn(): void {
    if (!this.googleClientId || !this.googleButton?.nativeElement) {
      this.googleUnavailable.set(true);
      return;
    }

    this.loadGoogleScript()
      .then(() => {
        if (!window.google || !this.googleButton?.nativeElement) {
          this.googleUnavailable.set(true);
          return;
        }

        window.google.accounts.id.initialize({
          client_id: this.googleClientId,
          callback: (response) => this.handleGoogleCredential(response.credential),
        });
        window.google.accounts.id.renderButton(this.googleButton.nativeElement, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          width: 360,
          locale: 'fr',
        });
      })
      .catch(() => this.googleUnavailable.set(true));
  }

  private handleGoogleCredential(idToken?: string): void {
    if (!idToken) {
      this.ngZone.run(() => {
        this.errorMessage.set('Connexion Google impossible. Veuillez réessayer.');
      });
      return;
    }

    this.ngZone.run(() => {
      this.isGoogleLoading.set(true);
      this.errorMessage.set(null);
    });

    this.authService
      .googleLogin({ idToken })
      .pipe(finalize(() => this.ngZone.run(() => this.isGoogleLoading.set(false))))
      .subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.authSession.saveAuthResponse(response);
            this.feedback.success(AUTH_UI_MESSAGES.loginSuccess);
            this.navigateAfterLogin();
          });
        },
        error: (error: unknown) => {
          this.ngZone.run(() => {
            this.errorMessage.set(getHttpErrorMessage(error, 'Connexion Google impossible.'));
          });
        },
      });
  }

  private normalizeIdentifierDisplayControl(): void {
    const control = this.loginForm.controls.identifier;
    const normalized = this.looksLikePhone(control.value)
      ? toSenegalLocalPhoneInput(control.value)
      : control.value.trim().toLowerCase();
    control.setValue(normalized, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  private normalizePasswordControl(): void {
    const control = this.loginForm.controls.password;
    const normalized = control.value.trim();
    if (normalized !== control.value) {
      control.setValue(normalized, { emitEvent: false });
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private looksLikePhone(value: string): boolean {
    const trimmed = value.trim();
    return !trimmed.includes('@') && /^[+0-9().\s-]*$/.test(trimmed);
  }

  private navigateAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(safeInternalUrl(returnUrl) ?? '/services');
  }

  private isLocalhostGoogleOrigin(): boolean {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname);
  }

  private loadGoogleScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }
}
