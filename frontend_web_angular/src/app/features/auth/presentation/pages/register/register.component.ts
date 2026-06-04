import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../../data-access/auth.service';
import { RegisterRequestDto } from '../../../domain/models/auth.models';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AUTH_UI_MESSAGES } from '../../../domain/auth-ui.messages';
import {
  AUTH_VALIDATORS,
  SENEGAL_PHONE_DIAL_CODE,
  normalizeSenegalPhoneNumber,
} from '../../../domain/auth.validators';
import { ServicesService } from '../../../../services/data-access/services.service';

type RegisterRole = 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);
  private readonly servicesService = inject(ServicesService);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  medicalSpecialties = signal<string[]>([]);
  selectedMedicalDocuments = signal<string[]>([]);
  medicalExpertises = signal<string[]>([]);
  expertiseDraft = signal('');
  protected readonly messages = AUTH_UI_MESSAGES;

  registerForm = this.fb.nonNullable.group({
    name: ['', AUTH_VALIDATORS.name],
    phoneNumber: [SENEGAL_PHONE_DIAL_CODE, AUTH_VALIDATORS.phoneNumber],
    email: ['', [Validators.email]],
    password: ['', AUTH_VALIDATORS.password],
    role: ['CLIENT' as RegisterRole, [Validators.required]],
    adresse: ['', AUTH_VALIDATORS.address],
    medicalSpecialty: [''],
    acceptTerms: [false, [Validators.requiredTrue]],
  });

  ngOnInit(): void {
    this.loadMedicalSpecialties();
  }

  onSubmit(): void {
    this.normalizePhoneControl();

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formData = this.registerForm.getRawValue();
    const payload: RegisterRequestDto = {
      phoneNumber: formData.phoneNumber,
      name: formData.name,
      password: formData.password,
      role: formData.role,
      adresse: formData.adresse,
      email: formData.email ? formData.email : undefined,
    };

    if (formData.role === 'MEDECIN') {
      payload.medicalSpecialty = formData.medicalSpecialty || undefined;
      payload.medicalExpertises = this.medicalExpertises();
      payload.medicalDocumentNames = this.selectedMedicalDocuments();
    }

    this.authService
      .register(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.authSession.saveAuthResponse(response);
          this.feedback.success(AUTH_UI_MESSAGES.registerSuccess);
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

  selectedRole(): RegisterRole {
    return this.registerForm.controls.role.value;
  }

  selectRole(role: RegisterRole): void {
    this.registerForm.controls.role.setValue(role);
  }

  protected onPhoneInput(): void {
    const control = this.registerForm.controls.phoneNumber;
    const normalized = normalizeSenegalPhoneNumber(control.value);

    if (normalized !== control.value) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  protected onPhoneBlur(): void {
    this.normalizePhoneControl();
  }

  addExpertise(): void {
    const value = this.expertiseDraft().trim();
    if (!value) return;

    this.medicalExpertises.update((items) =>
      items.some((item) => item.toLowerCase() === value.toLowerCase())
        ? items
        : [...items, value],
    );
    this.expertiseDraft.set('');
  }

  removeExpertise(index: number): void {
    this.medicalExpertises.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  onDocumentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.selectedMedicalDocuments.set(files.map((file) => file.name));
  }

  private loadMedicalSpecialties(): void {
    this.servicesService
      .getCategories(1, 100)
      .pipe(catchError(() => of({ items: [] })))
      .subscribe(({ items }) => {
        const names = items
          .map((category) => category.nom)
          .filter((name) => {
            const normalized = name
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();
            return ['medec', 'sante', 'soin', 'chirurg', 'dent'].some((keyword) =>
              normalized.includes(keyword),
            );
          });

        this.medicalSpecialties.set(names.length ? names : items.map((category) => category.nom));
      });
  }

  private normalizePhoneControl(): void {
    const control = this.registerForm.controls.phoneNumber;
    const normalized = normalizeSenegalPhoneNumber(control.value);
    control.setValue(normalized, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }
}
