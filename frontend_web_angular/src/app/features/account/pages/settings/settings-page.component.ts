import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';
import {
  AuthService,
  MedicalProfileView,
  MedicalTreatmentView,
  SavedPaymentMethodType,
  SavedPaymentMethodView,
  UserHistoryItemView,
} from '../../../auth/data-access/auth.service';
import { AUTH_UI_MESSAGES } from '../../../auth/domain/auth-ui.messages';
import { UserProfileDto } from '../../../auth/domain/models/auth.models';

type SettingsSection = 'health' | 'account';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AppFooterComponent,
    AppNavbarComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly authSession = inject(AuthSessionService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly profile = signal<UserProfileDto | null>(null);
  protected readonly activeSection = signal<SettingsSection>('health');
  protected readonly isLoading = signal(false);
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingAddress = signal(false);
  protected readonly isSavingAvatar = signal(false);
  protected readonly isSavingPaymentMethod = signal(false);
  protected readonly isSavingMedicalProfile = signal(false);
  protected readonly isSavingTreatment = signal(false);
  protected readonly isSavingPassword = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isEditingProfile = signal(false);
  protected readonly isEditingAddress = signal(false);
  protected readonly selectedPaymentType = signal<SavedPaymentMethodType>('CARD');
  protected readonly savedPaymentMethods = signal<SavedPaymentMethodView[]>([]);
  protected readonly medicalProfile = signal<MedicalProfileView | null>(null);
  protected readonly userHistory = signal<UserHistoryItemView[]>([]);
  protected readonly editingPaymentMethodId = signal<string | null>(null);
  protected readonly editingTreatmentId = signal<string | null>(null);
  protected readonly isPaymentModalOpen = signal(false);
  protected readonly isMedicalProfileModalOpen = signal(false);
  protected readonly isTreatmentModalOpen = signal(false);
  protected readonly showSensitivePaymentInfo = signal(false);
  protected readonly profileForm = {
    firstName: '',
    lastName: '',
    email: '',
  };
  protected readonly addressForm = {
    address: '',
  };
  protected readonly cardForm = {
    cardNumber: '',
    holderName: '',
    expiryMonth: 12,
    expiryYear: new Date().getFullYear() + 1,
  };
  protected readonly waveForm = {
    phoneNumber: '',
  };
  protected readonly passwordForm = {
    currentPassword: '',
    newPassword: '',
  };
  protected readonly medicalProfileForm = {
    bloodGroup: '',
    rhesus: '',
    weightKg: null as number | null,
    heightCm: null as number | null,
    referenceDoctorName: '',
    profession: '',
    allergiesText: '',
    conditionsText: '',
  };
  protected readonly treatmentForm = {
    name: '',
    dosage: '',
    frequency: '',
    startedAt: '',
    endedAt: '',
    notes: '',
  };
  protected readonly displayName = computed(() => this.profile()?.nom || this.currentUser()?.name || 'Mon profil');
  protected readonly initials = computed(() =>
    this.displayName()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U',
  );
  protected readonly roleLabel = computed(() => {
    const role = this.profile()?.role || this.currentUser()?.role;
    if (role === 'PRESTATAIRE') return 'Prestataire';
    if (role === 'MEDECIN') return 'Medecin';
    if (role === 'ADMIN') return 'Administrateur';
    return 'Client';
  });
  protected readonly roleBadge = computed(() => `${this.roleLabel().toUpperCase()} JOKKO`);
  protected readonly addressParts = computed(() => {
    const address = this.profile()?.adresse || '';
    const normalized = address.toLowerCase();
    const segments = address
      .split(/[,-]/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      country: normalized.includes('senegal') || normalized.includes('senegal') || normalized.includes('sénégal')
        ? 'Senegal'
        : 'Non renseigne',
      city: segments.find((part) => /dakar|thies|thiès|saint-louis|kaolack|ziguinchor/i.test(part)) || 'Non renseigne',
      postalCode: 'Non renseigne',
    };
  });
  protected readonly savedCards = computed(() =>
    this.savedPaymentMethods().filter((method) => method.type === 'CARD'),
  );
  protected readonly savedWaveNumbers = computed(() =>
    this.savedPaymentMethods().filter((method) => method.type === 'WAVE'),
  );
  protected readonly modalPaymentMethods = computed(() =>
    this.selectedPaymentType() === 'CARD' ? this.savedCards() : this.savedWaveNumbers(),
  );
  protected readonly defaultCard = computed(() => this.savedCards()[0] ?? null);
  protected readonly defaultWaveNumber = computed(() => this.savedWaveNumbers()[0] ?? null);
  protected readonly defaultCardLabel = computed(() => this.defaultCard()?.maskedValue || 'Aucune carte');
  protected readonly defaultWaveLabel = computed(() =>
    this.defaultWaveNumber()?.maskedValue || this.profile()?.numeroTelephone || 'Non renseigne',
  );
  protected readonly visibleCardLabel = computed(() =>
    this.showSensitivePaymentInfo()
      ? this.defaultCard()
        ? 'Carte securisee ' + this.extractLastDigits(this.defaultCard()?.maskedValue)
        : 'Aucune carte'
      : this.defaultCard()
        ? '******** ' + this.extractLastDigits(this.defaultCard()?.maskedValue)
        : 'Aucune carte',
  );
  protected readonly visibleWaveLabel = computed(() =>
    this.showSensitivePaymentInfo()
      ? this.defaultWaveLabel()
      : this.defaultWaveNumber()
        ? '****** ' + this.extractLastDigits(this.defaultWaveLabel())
        : this.profile()?.numeroTelephone
          ? '****** ' + this.extractLastDigits(this.profile()?.numeroTelephone)
          : 'Non renseigne',
  );
  protected readonly medicalOverview = computed(() => {
    const profile = this.medicalProfile();
    return [
      { label: 'Groupe sanguin', value: profile?.bloodGroup || 'Non renseigne', tone: 'orange' },
      { label: 'Rhesus', value: profile?.rhesus || 'Non renseigne', tone: 'green' },
      { label: 'Poids', value: profile?.weightKg ? `${profile.weightKg} kg` : 'Non renseigne', tone: 'blue' },
      { label: 'Medecin ref.', value: profile?.referenceDoctorName || 'Non renseigne', tone: 'dark' },
      { label: 'Profession', value: profile?.profession || this.roleLabel(), tone: 'orange' },
      { label: 'Taille', value: profile?.heightCm ? `${profile.heightCm} cm` : 'Non renseigne', tone: 'blue' },
      { label: 'IMC', value: profile?.bmi ? `${profile.bmi}` : 'Non renseigne', tone: 'dark' },
    ];
  });
  protected readonly medicalAlerts = computed(() => {
    const profile = this.medicalProfile();
    if (!profile) return [];
    return [
      ...profile.allergies.map((item) => ({ label: `Allergie : ${item}`, tone: 'red' })),
      ...profile.conditions.map((item) => ({ label: item, tone: 'blue' })),
    ];
  });
  protected readonly medicalTreatments = computed(() => this.medicalProfile()?.treatments ?? []);
  protected readonly recentMedicalActs = computed(() => this.userHistory().slice(0, 4));
  protected readonly hasMedicalData = computed(() => this.recentMedicalActs().length > 0);

  ngOnInit(): void {
    if (!this.currentUser()) return;
    this.loadProfile();
    this.loadMedicalProfile();
    this.loadPaymentMethods();
    this.loadUserHistory();
  }

  protected selectSection(section: SettingsSection): void {
    this.activeSection.set(section);
    if (section === 'account') {
      this.loadPaymentMethods();
    }
  }

  protected selectPaymentType(type: SavedPaymentMethodType): void {
    this.selectedPaymentType.set(type);
    this.editingPaymentMethodId.set(null);
    this.resetPaymentForms();
  }

  protected goBack(): void {
    this.router.navigate(['/services']);
  }

  protected selectAccountPayment(type: SavedPaymentMethodType): void {
    this.activeSection.set('account');
    this.selectPaymentType(type);
    const existing = type === 'CARD' ? this.defaultCard() : this.defaultWaveNumber();
    if (existing) {
      this.editPaymentMethod(existing);
      return;
    }
    this.isPaymentModalOpen.set(true);
  }

  protected closePaymentModal(): void {
    this.isPaymentModalOpen.set(false);
    this.clearPaymentEdit();
  }

  protected openMedicalProfileModal(): void {
    this.syncMedicalProfileForm(this.medicalProfile());
    this.isMedicalProfileModalOpen.set(true);
  }

  protected closeMedicalProfileModal(): void {
    this.isMedicalProfileModalOpen.set(false);
  }

  protected openTreatmentModal(): void {
    this.editingTreatmentId.set(null);
    this.resetTreatmentForm();
    this.isTreatmentModalOpen.set(true);
  }

  protected editTreatment(treatment: MedicalTreatmentView): void {
    this.editingTreatmentId.set(treatment.id);
    this.treatmentForm.name = treatment.name;
    this.treatmentForm.dosage = treatment.dosage || '';
    this.treatmentForm.frequency = treatment.frequency || '';
    this.treatmentForm.startedAt = treatment.startedAt || '';
    this.treatmentForm.endedAt = treatment.endedAt || '';
    this.treatmentForm.notes = treatment.notes || '';
    this.isTreatmentModalOpen.set(true);
  }

  protected closeTreatmentModal(): void {
    this.isTreatmentModalOpen.set(false);
    this.editingTreatmentId.set(null);
    this.resetTreatmentForm();
  }

  protected toggleSensitivePaymentInfo(): void {
    this.showSensitivePaymentInfo.update((visible) => !visible);
  }

  protected startProfileEdit(): void {
    this.syncForms(this.profile());
    this.isEditingProfile.set(true);
  }

  protected startAddressEdit(): void {
    this.syncForms(this.profile());
    this.isEditingAddress.set(true);
  }

  protected cancelProfileEdit(): void {
    this.syncForms(this.profile());
    this.isEditingProfile.set(false);
  }

  protected cancelAddressEdit(): void {
    this.syncForms(this.profile());
    this.isEditingAddress.set(false);
  }

  protected saveProfile(): void {
    if (this.isSavingProfile()) return;
    const name = `${this.profileForm.firstName} ${this.profileForm.lastName}`.trim();
    if (name.length < 2) {
      this.errorMessage.set('Le nom doit contenir au moins 2 caracteres.');
      return;
    }

    this.isSavingProfile.set(true);
    this.errorMessage.set(null);
    this.authService
      .updateMyProfile({
        name,
        email: this.profileForm.email.trim() || null,
      })
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: (profile) => this.applyUpdatedProfile(profile, 'Informations personnelles modifiees.'),
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de modifier le profil.'));
        },
      });
  }

  protected saveAddress(): void {
    if (this.isSavingAddress()) return;
    this.isSavingAddress.set(true);
    this.errorMessage.set(null);
    this.authService
      .updateMyProfile({
        address: this.addressForm.address.trim() || null,
      })
      .pipe(finalize(() => this.isSavingAddress.set(false)))
      .subscribe({
        next: (profile) => this.applyUpdatedProfile(profile, 'Adresse modifiee.'),
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, "Impossible de modifier l'adresse."));
        },
      });
  }

  protected uploadAvatar(event: Event): void {
    if (this.isSavingAvatar()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Selectionnez une image valide.');
      return;
    }

    this.isSavingAvatar.set(true);
    this.errorMessage.set(null);
    this.authService
      .uploadMyAvatar(file)
      .pipe(finalize(() => this.isSavingAvatar.set(false)))
      .subscribe({
        next: (profile) => this.applyUpdatedProfile(profile, 'Photo de profil modifiee.'),
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, "Impossible de modifier l'avatar."));
        },
      });
  }

  protected saveSelectedPaymentMethod(): void {
    if (this.isSavingPaymentMethod()) return;
    const type = this.selectedPaymentType();
    const editingId = this.editingPaymentMethodId();
    const payload =
      type === 'CARD'
        ? {
            type,
            label: 'Carte de credit',
            cardNumber: this.cardForm.cardNumber,
            holderName: this.cardForm.holderName || this.displayName(),
            expiryMonth: Number(this.cardForm.expiryMonth),
            expiryYear: Number(this.cardForm.expiryYear),
          }
        : {
            type,
            label: 'Wave',
            phoneNumber: this.waveForm.phoneNumber,
          };

    this.isSavingPaymentMethod.set(true);
    this.errorMessage.set(null);
    const request = editingId
      ? this.authService.updateSavedPaymentMethod(editingId, payload)
      : this.authService.createSavedPaymentMethod(payload);

    request.pipe(finalize(() => this.isSavingPaymentMethod.set(false))).subscribe({
      next: () => {
        this.feedback.success(editingId ? 'Moyen de paiement modifie.' : 'Moyen de paiement enregistre.');
        this.editingPaymentMethodId.set(null);
        this.resetPaymentForms();
        this.isPaymentModalOpen.set(false);
        this.loadPaymentMethods();
      },
      error: (error) => {
        this.errorMessage.set(getHttpErrorMessage(error, 'Impossible d enregistrer ce moyen de paiement.'));
      },
    });
  }

  protected editPaymentMethod(method: SavedPaymentMethodView): void {
    this.selectedPaymentType.set(method.type);
    this.editingPaymentMethodId.set(method.id);
    this.isPaymentModalOpen.set(true);
    if (method.type === 'CARD') {
      this.cardForm.cardNumber = method.maskedValue;
      this.cardForm.holderName = method.holderName || this.displayName();
      this.cardForm.expiryMonth = method.expiryMonth || 12;
      this.cardForm.expiryYear = method.expiryYear || new Date().getFullYear() + 1;
      return;
    }
    this.waveForm.phoneNumber = method.maskedValue;
  }

  protected clearPaymentEdit(): void {
    this.editingPaymentMethodId.set(null);
    this.resetPaymentForms();
  }

  protected deletePaymentMethod(method: SavedPaymentMethodView): void {
    const confirmed = window.confirm('Voulez-vous supprimer ce moyen de paiement ?');
    if (!confirmed) return;

    this.authService.deleteSavedPaymentMethod(method.id).subscribe({
      next: () => {
        this.feedback.success('Moyen de paiement supprime.');
        this.loadPaymentMethods();
      },
      error: (error) => {
        this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de supprimer ce moyen de paiement.'));
      },
    });
  }

  protected saveMedicalProfile(): void {
    if (this.isSavingMedicalProfile()) return;
    this.isSavingMedicalProfile.set(true);
    this.errorMessage.set(null);
    this.authService
      .updateMyMedicalProfile({
        bloodGroup: this.medicalProfileForm.bloodGroup.trim() || null,
        rhesus: this.medicalProfileForm.rhesus.trim() || null,
        weightKg: this.medicalProfileForm.weightKg,
        heightCm: this.medicalProfileForm.heightCm,
        referenceDoctorName: this.medicalProfileForm.referenceDoctorName.trim() || null,
        profession: this.medicalProfileForm.profession.trim() || null,
        allergies: this.parseTextList(this.medicalProfileForm.allergiesText),
        conditions: this.parseTextList(this.medicalProfileForm.conditionsText),
      })
      .pipe(finalize(() => this.isSavingMedicalProfile.set(false)))
      .subscribe({
        next: (profile) => {
          this.medicalProfile.set(profile);
          this.isMedicalProfileModalOpen.set(false);
          this.feedback.success('Fiche medicale mise a jour.');
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de modifier la fiche medicale.'));
        },
      });
  }

  protected saveTreatment(): void {
    if (this.isSavingTreatment()) return;
    const name = this.treatmentForm.name.trim();
    if (name.length < 2) {
      this.errorMessage.set('Le nom du traitement doit contenir au moins 2 caracteres.');
      return;
    }

    const payload = {
      name,
      dosage: this.treatmentForm.dosage.trim() || null,
      frequency: this.treatmentForm.frequency.trim() || null,
      startedAt: this.treatmentForm.startedAt || null,
      endedAt: this.treatmentForm.endedAt || null,
      notes: this.treatmentForm.notes.trim() || null,
    };
    const editingId = this.editingTreatmentId();
    const request = editingId
      ? this.authService.updateMyMedicalTreatment(editingId, payload)
      : this.authService.createMyMedicalTreatment(payload);

    this.isSavingTreatment.set(true);
    this.errorMessage.set(null);
    request.pipe(finalize(() => this.isSavingTreatment.set(false))).subscribe({
      next: (profile) => {
        this.medicalProfile.set(profile);
        this.closeTreatmentModal();
        this.feedback.success(editingId ? 'Traitement modifie.' : 'Traitement ajoute.');
      },
      error: (error) => {
        this.errorMessage.set(getHttpErrorMessage(error, 'Impossible d enregistrer le traitement.'));
      },
    });
  }

  protected deleteTreatment(treatment: MedicalTreatmentView): void {
    const confirmed = window.confirm(`Voulez-vous supprimer le traitement "${treatment.name}" ?`);
    if (!confirmed) return;
    this.authService.deleteMyMedicalTreatment(treatment.id).subscribe({
      next: (profile) => {
        this.medicalProfile.set(profile);
        this.feedback.success('Traitement supprime.');
      },
      error: (error) => {
        this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de supprimer le traitement.'));
      },
    });
  }

  protected logout(): void {
    this.authService
      .logout()
      .pipe(
        catchError(() => of(undefined)),
        finalize(() => {
          this.authSession.clear();
          this.feedback.success(AUTH_UI_MESSAGES.logoutSuccess);
          this.router.navigate(['/services']);
        }),
      )
      .subscribe();
  }

  protected savePassword(): void {
    if (this.isSavingPassword()) return;
    if (this.passwordForm.currentPassword.length < 8 || this.passwordForm.newPassword.length < 8) {
      this.errorMessage.set('Les mots de passe doivent contenir au moins 8 caracteres.');
      return;
    }

    this.isSavingPassword.set(true);
    this.errorMessage.set(null);
    this.authService
      .changeMyPassword({
        currentPassword: this.passwordForm.currentPassword,
        newPassword: this.passwordForm.newPassword,
      })
      .pipe(finalize(() => this.isSavingPassword.set(false)))
      .subscribe({
        next: () => {
          this.passwordForm.currentPassword = '';
          this.passwordForm.newPassword = '';
          this.feedback.success('Mot de passe mis a jour avec succes.');
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de modifier le mot de passe.'));
        },
      });
  }

  protected deleteAccount(): void {
    if (this.isDeleting()) return;
    const confirmed = window.confirm('Voulez-vous vraiment supprimer ce compte ? Cette action est definitive.');
    if (!confirmed) return;

    this.isDeleting.set(true);
    this.authService
      .deleteMyAccount()
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.authSession.clear();
          this.feedback.success('Compte supprime avec succes.');
          this.router.navigate(['/services']);
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de supprimer ce compte.'));
        },
      });
  }

  private loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.authService
      .myUserProfile()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.authSession.saveUserProfile(profile);
          this.syncForms(profile);
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger le profil.'));
        },
      });
  }

  private loadPaymentMethods(): void {
    if (!this.currentUser()) return;
    this.authService
      .listSavedPaymentMethods()
      .pipe(catchError(() => of([])))
      .subscribe((methods) => this.savedPaymentMethods.set(methods));
  }

  private loadUserHistory(): void {
    if (!this.currentUser()) return;
    this.authService
      .myUserHistory(8)
      .pipe(catchError(() => of([])))
      .subscribe((history) => this.userHistory.set(history));
  }

  private loadMedicalProfile(): void {
    if (!this.currentUser()) return;
    this.authService
      .getMyMedicalProfile()
      .pipe(catchError(() => of(null)))
      .subscribe((profile) => {
        this.medicalProfile.set(profile);
        this.syncMedicalProfileForm(profile);
      });
  }

  private applyUpdatedProfile(profile: UserProfileDto, message: string): void {
    this.profile.set(profile);
    this.authSession.saveUserProfile(profile);
    this.syncForms(profile);
    this.isEditingProfile.set(false);
    this.isEditingAddress.set(false);
    this.feedback.success(message);
  }

  private syncForms(profile: UserProfileDto | null): void {
    const nameParts = (profile?.nom || this.currentUser()?.name || '').split(' ').filter(Boolean);
    this.profileForm.firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || '';
    this.profileForm.lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    this.profileForm.email = profile?.email || this.currentUser()?.email || '';
    this.addressForm.address = profile?.adresse || '';
    this.cardForm.holderName = profile?.nom || this.currentUser()?.name || '';
    this.waveForm.phoneNumber = profile?.numeroTelephone || this.currentUser()?.phoneNumber || '';
  }

  private resetPaymentForms(): void {
    this.cardForm.cardNumber = '';
    this.cardForm.holderName = this.displayName();
    this.cardForm.expiryMonth = 12;
    this.cardForm.expiryYear = new Date().getFullYear() + 1;
    this.waveForm.phoneNumber = this.profile()?.numeroTelephone || this.currentUser()?.phoneNumber || '';
  }

  private syncMedicalProfileForm(profile: MedicalProfileView | null): void {
    this.medicalProfileForm.bloodGroup = profile?.bloodGroup || '';
    this.medicalProfileForm.rhesus = profile?.rhesus || '';
    this.medicalProfileForm.weightKg = profile?.weightKg ?? null;
    this.medicalProfileForm.heightCm = profile?.heightCm ?? null;
    this.medicalProfileForm.referenceDoctorName = profile?.referenceDoctorName || '';
    this.medicalProfileForm.profession = profile?.profession || '';
    this.medicalProfileForm.allergiesText = (profile?.allergies ?? []).join('\n');
    this.medicalProfileForm.conditionsText = (profile?.conditions ?? []).join('\n');
  }

  private resetTreatmentForm(): void {
    this.treatmentForm.name = '';
    this.treatmentForm.dosage = '';
    this.treatmentForm.frequency = '';
    this.treatmentForm.startedAt = '';
    this.treatmentForm.endedAt = '';
    this.treatmentForm.notes = '';
  }

  private parseTextList(value: string): string[] {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  private extractLastDigits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '').slice(-4) || '----';
  }
}
