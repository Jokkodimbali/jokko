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
import { CategoryStructure, ServiceSubCategory } from '../../../../services/domain/models/services.models';

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
  categoryStructure = signal<CategoryStructure[]>([]);
  selectedMedicalDocuments = signal<string[]>([]);
  medicalExpertises = signal<string[]>([]);
  expertiseDraft = signal('');
  selectedCategoryIds = signal<string[]>([]);
  selectedSubCategoryIds = signal<string[]>([]);
  categorySelectValue = signal('');
  subCategorySelectValue = signal('');
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
    this.loadProfessionalCategoryStructure();
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
    if (this.requiresProfessionalSpecialties() && this.selectedCategoryIds().length === 0) {
      this.errorMessage.set(
        formData.role === 'MEDECIN'
          ? 'Selectionnez au moins une categorie medicale pour creer votre compte medecin.'
          : 'Selectionnez au moins une categorie de service pour creer votre compte prestataire.',
      );
      return;
    }

    const payload: RegisterRequestDto = {
      phoneNumber: formData.phoneNumber,
      name: formData.name,
      password: formData.password,
      role: formData.role,
      adresse: formData.adresse,
      email: formData.email ? formData.email : undefined,
    };

    if (formData.role === 'PRESTATAIRE' || formData.role === 'MEDECIN') {
      payload.categoryIds = this.selectedCategoryIds();
      payload.subCategoryIds = this.selectedSubCategoryIds();
    }

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
    this.selectedCategoryIds.set([]);
    this.selectedSubCategoryIds.set([]);
    this.categorySelectValue.set('');
    this.subCategorySelectValue.set('');
    this.registerForm.controls.medicalSpecialty.setValue('');
    this.errorMessage.set(null);
  }

  protected requiresProfessionalSpecialties(): boolean {
    return this.selectedRole() === 'PRESTATAIRE' || this.selectedRole() === 'MEDECIN';
  }

  protected availableCategories(): CategoryStructure[] {
    const categories = this.categoryStructure();
    return this.selectedRole() === 'MEDECIN'
      ? categories.filter((category) => this.isMedicalCategory(category.nom))
      : categories;
  }

  protected selectedCategories(): CategoryStructure[] {
    const selected = new Set(this.selectedCategoryIds());
    return this.availableCategories().filter((category) => selected.has(category.id));
  }

  protected selectedSubCategories(): ServiceSubCategory[] {
    const selected = new Set(this.selectedSubCategoryIds());
    return this.selectedCategories()
      .flatMap((category) => category.subCategories)
      .filter((subCategory) => selected.has(subCategory.id));
  }

  protected availableSubCategoriesForSelectedCategories(): ServiceSubCategory[] {
    const selected = new Set(this.selectedSubCategoryIds());
    return this.selectedCategories()
      .flatMap((category) => category.subCategories)
      .filter((subCategory) => !selected.has(subCategory.id))
      .sort((first, second) => first.ordreTri - second.ordreTri || first.nom.localeCompare(second.nom, 'fr'));
  }

  protected isCategorySelected(categoryId: string): boolean {
    return this.selectedCategoryIds().includes(categoryId);
  }

  protected isSubCategorySelected(subCategoryId: string): boolean {
    return this.selectedSubCategoryIds().includes(subCategoryId);
  }

  protected toggleCategory(category: CategoryStructure): void {
    const selected = new Set(this.selectedCategoryIds());
    if (selected.has(category.id)) {
      selected.delete(category.id);
      const subCategoryIds = new Set(category.subCategories.map((subCategory) => subCategory.id));
      this.selectedSubCategoryIds.update((ids) => ids.filter((id) => !subCategoryIds.has(id)));
    } else {
      selected.add(category.id);
    }

    this.selectedCategoryIds.set(Array.from(selected));
    this.syncMedicalSpecialtyFromSelection();
  }

  protected addSelectedCategory(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const categoryId = select.value;
    const category = this.availableCategories().find((item) => item.id === categoryId);
    if (category && !this.isCategorySelected(category.id)) {
      this.toggleCategory(category);
    }
    this.categorySelectValue.set('');
    select.value = '';
  }

  protected addSelectedSubCategory(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const subCategoryId = select.value;
    const category = this.selectedCategories().find((item) =>
      item.subCategories.some((subCategory) => subCategory.id === subCategoryId),
    );
    const subCategory = category?.subCategories.find((item) => item.id === subCategoryId);
    if (category && subCategory && !this.isSubCategorySelected(subCategory.id)) {
      this.toggleSubCategory(category, subCategory);
    }
    this.subCategorySelectValue.set('');
    select.value = '';
  }

  protected removeSelectedCategory(category: CategoryStructure): void {
    if (this.isCategorySelected(category.id)) {
      this.toggleCategory(category);
    }
  }

  protected removeSelectedSubCategory(subCategory: ServiceSubCategory): void {
    const category = this.selectedCategories().find((item) =>
      item.subCategories.some((candidate) => candidate.id === subCategory.id),
    );
    if (category) {
      this.toggleSubCategory(category, subCategory);
    }
  }

  protected toggleSubCategory(category: CategoryStructure, subCategory: ServiceSubCategory): void {
    if (!this.isCategorySelected(category.id)) {
      this.toggleCategory(category);
    }

    const selected = new Set(this.selectedSubCategoryIds());
    if (selected.has(subCategory.id)) {
      selected.delete(subCategory.id);
    } else {
      selected.add(subCategory.id);
    }
    this.selectedSubCategoryIds.set(Array.from(selected));
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

  updateExpertiseDraft(event: Event): void {
    this.expertiseDraft.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  removeExpertise(index: number): void {
    this.medicalExpertises.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  onDocumentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.selectedMedicalDocuments.set(files.map((file) => file.name));
  }

  private loadProfessionalCategoryStructure(): void {
    this.servicesService
      .getCategoryStructure()
      .pipe(catchError(() => of([])))
      .subscribe((items) => {
        this.categoryStructure.set(items);
      });
  }

  private normalizePhoneControl(): void {
    const control = this.registerForm.controls.phoneNumber;
    const normalized = normalizeSenegalPhoneNumber(control.value);
    control.setValue(normalized, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  private syncMedicalSpecialtyFromSelection(): void {
    if (this.selectedRole() !== 'MEDECIN') return;
    const firstCategory = this.selectedCategories()[0];
    this.registerForm.controls.medicalSpecialty.setValue(firstCategory?.nom ?? '');
  }

  private isMedicalCategory(name: string): boolean {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return [
      'medec',
      'medical',
      'sante',
      'soin',
      'clinique',
      'hopital',
      'pharma',
      'dent',
      'chirurg',
      'gyneco',
      'pediatr',
      'cardio',
      'doct',
      'infirm',
      'cabinet',
    ].some((keyword) => normalized.includes(keyword));
  }
}
