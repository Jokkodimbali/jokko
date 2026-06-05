import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  PaymentEscrowStatusView,
  PaymentHistoryView,
  SavedPaymentMethodType,
  SavedPaymentMethodView,
  UserHistoryItemView,
  WithdrawalRequestView,
} from '../../../auth/data-access/auth.service';
import { AUTH_UI_MESSAGES } from '../../../auth/domain/auth-ui.messages';
import {
  displaySenegalPhoneNumber,
  normalizeSenegalPhoneNumber,
  toSenegalLocalPhoneInput,
} from '../../../auth/domain/auth.validators';
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
  private readonly route = inject(ActivatedRoute);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly profile = signal<UserProfileDto | null>(null);
  protected readonly activeSection = signal<SettingsSection>('health');
  protected readonly isLoading = signal(false);
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingProfessionalAbout = signal(false);
  protected readonly isSavingAddress = signal(false);
  protected readonly isSavingAvatar = signal(false);
  protected readonly isSavingPaymentMethod = signal(false);
  protected readonly isLoadingPayments = signal(false);
  protected readonly paymentActionId = signal<string | null>(null);
  protected readonly isSavingMedicalProfile = signal(false);
  protected readonly isSavingTreatment = signal(false);
  protected readonly isSavingPassword = signal(false);
  protected readonly isUploadingProfessionalDocument = signal(false);
  protected readonly isSavingProfessionalExpertise = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly lastProfessionalDocumentUpload = signal<{
    name: string;
    status: 'pending' | 'success' | 'error';
  } | null>(null);
  protected readonly isEditingProfile = signal(false);
  protected readonly isEditingProfessionalAbout = signal(false);
  protected readonly isEditingAddress = signal(false);
  protected readonly selectedPaymentType = signal<SavedPaymentMethodType>('CARD');
  protected readonly savedPaymentMethods = signal<SavedPaymentMethodView[]>([]);
  protected readonly paymentHistory = signal<PaymentHistoryView[]>([]);
  protected readonly withdrawalRequests = signal<WithdrawalRequestView[]>([]);
  protected readonly paymentEscrowStatuses = signal<Record<string, PaymentEscrowStatusView>>({});
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
    phoneNumber: '',
  };
  protected readonly professionalAboutForm = {
    about: '',
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
  protected readonly professionalExpertiseForm = {
    name: '',
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
    this.defaultWaveNumber()?.maskedValue || this.displayPhoneNumber() || 'Non renseigne',
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
        : this.displayPhoneNumber()
          ? '****** ' + this.extractLastDigits(this.displayPhoneNumber())
          : 'Non renseigne',
  );
  protected readonly recentPayments = computed(() => {
    const history = this.paymentHistory();
    return Array.isArray(history) ? history.slice(0, 6) : [];
  });
  protected readonly recentWithdrawals = computed(() => this.withdrawalRequests().slice(0, 4));
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
  protected readonly isProfessionalSettings = computed(() => {
    const role = this.profile()?.role || this.currentUser()?.role;
    return role === 'MEDECIN' || role === 'PRESTATAIRE';
  });
  protected readonly hasLocalPassword = computed(() => this.profile()?.hasPassword ?? true);
  protected readonly displayPhoneNumber = computed(() =>
    displaySenegalPhoneNumber(this.profile()?.numeroTelephone || this.currentUser()?.phoneNumber),
  );
  protected readonly professionalProfile = computed(() => this.profile()?.profilProfessionnel ?? null);
  protected readonly professionalBiographyLines = computed(() => this.parseProfessionalBiography());
  protected readonly professionalSpecialty = computed(() => {
    const explicitSpecialty = this.professionalBiographyLines().specialty;
    if (explicitSpecialty) return explicitSpecialty;
    return this.professionalProfile()?.categories[0] || this.roleLabel();
  });
  protected readonly professionalTitle = computed(() => {
    const specialty = this.professionalSpecialty();
    return specialty && specialty !== this.roleLabel() ? `${specialty} passionne par l'excellence` : 'Professionnel Jokko certifie';
  });
  protected readonly professionalAbout = computed(() => {
    const rawBiography = this.professionalProfile()?.biographie || '';
    const cleaned = rawBiography
      .split('\n')
      .filter((line) => !/^(Specialite|Expertises|Documents):/i.test(line.trim()))
      .join(' ')
      .trim();

    if (cleaned && !cleaned.includes('Profil medecin en attente')) return cleaned;
    return `Bienvenue sur mon profil. Je suis ${this.displayName()}, ${this.professionalSpecialty().toLowerCase()}, et je propose un accompagnement professionnel valide par Jokko Dimbali.`;
  });
  protected readonly professionalExpertises = computed(() => this.professionalBiographyLines().expertises);
  protected readonly professionalDocuments = computed(() => {
    const diplomas = this.professionalProfile()?.diplomesMedicaux ?? [];
    if (diplomas.length > 0) {
      return diplomas.map((diploma) => ({
        id: diploma.id,
        label: diploma.titre,
        meta: diploma.etablissement || 'Document professionnel',
        status: diploma.statut,
        url: diploma.urlDocument ?? null,
      }));
    }

    return this.professionalBiographyLines().documents.map((document, index) => ({
      id: `bio-document-${index}`,
      label: document,
      meta: 'Document declare a l inscription',
      status: 'DECLARE',
      url: null,
    }));
  });
  protected readonly validatedDocumentsCount = computed(() => this.professionalDocuments().length);

  ngOnInit(): void {
    if (!this.currentUser()) return;
    const requestedSection = this.route.snapshot.queryParamMap.get('section');
    if (requestedSection === 'account') {
      this.activeSection.set('account');
    }
    this.loadProfile();
    this.loadMedicalProfile();
    this.loadPaymentMethods();
    if (this.activeSection() === 'account') {
      this.loadPaymentActivity();
    }
    this.loadUserHistory();
  }

  protected selectSection(section: SettingsSection): void {
    this.activeSection.set(section);
    if (section === 'account') {
      this.loadPaymentMethods();
      this.loadPaymentActivity();
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

  protected startProfessionalAboutEdit(): void {
    this.professionalAboutForm.about = this.professionalAbout();
    this.isEditingProfessionalAbout.set(true);
  }

  protected startAddressEdit(): void {
    this.syncForms(this.profile());
    this.isEditingAddress.set(true);
  }

  protected cancelProfileEdit(): void {
    this.syncForms(this.profile());
    this.isEditingProfile.set(false);
  }

  protected cancelProfessionalAboutEdit(): void {
    this.professionalAboutForm.about = this.professionalAbout();
    this.isEditingProfessionalAbout.set(false);
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
    const phoneNumber = this.profileForm.phoneNumber.trim();
    if (phoneNumber && !displaySenegalPhoneNumber(phoneNumber)) {
      const message = 'Renseignez un numero senegalais valide.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    this.isSavingProfile.set(true);
    this.errorMessage.set(null);
    this.authService
      .updateMyProfile({
        name,
        email: this.profileForm.email.trim() || null,
        phoneNumber: phoneNumber ? normalizeSenegalPhoneNumber(phoneNumber) : undefined,
      })
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: (profile) => this.applyUpdatedProfile(profile, 'Informations personnelles modifiees.'),
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de modifier le profil.'));
        },
      });
  }

  protected saveProfessionalAbout(): void {
    if (this.isSavingProfessionalAbout()) return;
    const about = this.professionalAboutForm.about.trim();
    if (about.length < 20) {
      const message = 'La presentation doit contenir au moins 20 caracteres.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    this.isSavingProfessionalAbout.set(true);
    this.errorMessage.set(null);
    this.authService
      .updateMyProfessionalAbout(about)
      .pipe(finalize(() => this.isSavingProfessionalAbout.set(false)))
      .subscribe({
        next: (profile) => {
          this.isEditingProfessionalAbout.set(false);
          this.applyUpdatedProfile(profile, 'Presentation professionnelle modifiee.');
        },
        error: (error) => {
          const message = getHttpErrorMessage(error, 'Impossible de modifier la presentation.');
          this.errorMessage.set(message);
          this.feedback.error(message);
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
      this.feedback.error('Selectionnez une image valide.');
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
          const message = getHttpErrorMessage(error, "Impossible de modifier l'avatar.");
          this.errorMessage.set(message);
          this.feedback.error(message);
        },
      });
  }

  protected uploadProfessionalDocument(event: Event): void {
    if (this.isUploadingProfessionalDocument()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    if (!allowedTypes.has(file.type)) {
      const message = 'Selectionnez un document PDF, image ou Word.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      const message = 'Le document ne doit pas depasser 10 Mo.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    this.isUploadingProfessionalDocument.set(true);
    this.errorMessage.set(null);
    this.lastProfessionalDocumentUpload.set({ name: file.name, status: 'pending' });
    this.authService
      .uploadMyProfessionalCredential(file)
      .pipe(finalize(() => this.isUploadingProfessionalDocument.set(false)))
      .subscribe({
        next: (profile) => {
          this.lastProfessionalDocumentUpload.set({ name: file.name, status: 'success' });
          this.applyUpdatedProfile(profile, 'Document professionnel ajoute.');
        },
        error: (error) => {
          const message = getHttpErrorMessage(error, "Impossible d'ajouter ce document.");
          this.lastProfessionalDocumentUpload.set({ name: file.name, status: 'error' });
          this.errorMessage.set(message);
          this.feedback.error(message);
        },
      });
  }

  protected addProfessionalExpertise(): void {
    if (this.isSavingProfessionalExpertise()) return;
    const name = this.professionalExpertiseForm.name.trim();
    if (name.length < 2) {
      const message = 'Renseignez une expertise valide.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    this.isSavingProfessionalExpertise.set(true);
    this.errorMessage.set(null);
    this.authService
      .addMyProfessionalExpertise(name)
      .pipe(finalize(() => this.isSavingProfessionalExpertise.set(false)))
      .subscribe({
        next: (profile) => {
          this.professionalExpertiseForm.name = '';
          this.applyUpdatedProfile(profile, 'Expertise ajoutee.');
        },
        error: (error) => {
          const message = getHttpErrorMessage(error, "Impossible d'ajouter cette expertise.");
          this.errorMessage.set(message);
          this.feedback.error(message);
        },
      });
  }

  protected deleteProfessionalDocument(document: { id: string; label: string }): void {
    if (document.id.startsWith('bio-document-')) {
      this.feedback.error('Ce document declare ne peut pas etre supprime depuis cette action.');
      return;
    }

    const confirmed = window.confirm(`Voulez-vous supprimer le document "${document.label}" ?`);
    if (!confirmed) return;

    this.authService.deleteMyProfessionalCredential(document.id).subscribe({
      next: (profile) => this.applyUpdatedProfile(profile, 'Document professionnel supprime.'),
      error: (error) => {
        const message = getHttpErrorMessage(error, 'Impossible de supprimer ce document.');
        this.errorMessage.set(message);
        this.feedback.error(message);
      },
    });
  }

  protected removeProfessionalExpertise(name: string): void {
    if (this.isSavingProfessionalExpertise()) return;

    this.isSavingProfessionalExpertise.set(true);
    this.errorMessage.set(null);
    this.authService
      .removeMyProfessionalExpertise(name)
      .pipe(finalize(() => this.isSavingProfessionalExpertise.set(false)))
      .subscribe({
        next: (profile) => this.applyUpdatedProfile(profile, 'Expertise retiree.'),
        error: (error) => {
          const message = getHttpErrorMessage(error, 'Impossible de retirer cette expertise.');
          this.errorMessage.set(message);
          this.feedback.error(message);
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

  protected releaseEscrow(payment: PaymentHistoryView): void {
    const paymentId = payment.id;
    if (!paymentId || this.paymentActionId()) return;
    this.paymentActionId.set(paymentId);
    this.authService
      .releasePaymentEscrow(paymentId)
      .pipe(finalize(() => this.paymentActionId.set(null)))
      .subscribe({
        next: (updated) => {
          this.patchPayment(updated);
          this.loadPaymentEscrowStatus(paymentId);
          this.feedback.success('Paiement libere avec succes.');
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Impossible de liberer ce paiement.'));
        },
      });
  }

  protected disputeEscrow(payment: PaymentHistoryView): void {
    const paymentId = payment.id;
    if (!paymentId || this.paymentActionId()) return;
    this.paymentActionId.set(paymentId);
    this.authService
      .disputePaymentEscrow(paymentId, 'Contestation ouverte depuis les parametres client.')
      .pipe(finalize(() => this.paymentActionId.set(null)))
      .subscribe({
        next: (updated) => {
          this.patchPayment(updated);
          this.loadPaymentEscrowStatus(paymentId);
          this.feedback.success('Contestation du paiement transmise.');
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Impossible de contester ce paiement.'));
        },
      });
  }

  protected refreshPayment(payment: PaymentHistoryView): void {
    if (this.paymentActionId()) return;
    this.paymentActionId.set(payment.id);
    this.authService
      .getPayment(payment.id)
      .pipe(finalize(() => this.paymentActionId.set(null)))
      .subscribe({
        next: (updated) => {
          this.patchPayment(updated);
          this.loadPaymentEscrowStatus(payment.id);
          this.feedback.success('Paiement synchronise.');
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Impossible de synchroniser ce paiement.'));
        },
      });
  }

  protected paymentAmount(payment: PaymentHistoryView): number {
    return Number(payment.amount ?? payment.montant ?? 0);
  }

  protected paymentStatus(payment: PaymentHistoryView): string {
    return payment.status || payment.statut || 'STATUT_NON_RENSEIGNE';
  }

  protected paymentMethod(payment: PaymentHistoryView): string {
    return payment.method || payment.methode || 'Methode non renseignee';
  }

  protected paymentDate(payment: PaymentHistoryView): string | null {
    return payment.createdAt || payment.creeLe || null;
  }

  protected withdrawalId(withdrawal: WithdrawalRequestView): string {
    return withdrawal.id || withdrawal.withdrawalId || 'retrait';
  }

  protected withdrawalAmount(withdrawal: WithdrawalRequestView): number {
    const amount = withdrawal.amount;
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'object' && amount !== null && 'value' in amount) return (amount as any).value || 0;
    return 0;
  }

  protected withdrawalDate(withdrawal: WithdrawalRequestView): string | null {
    return withdrawal.requestedAt || withdrawal.createdAt || null;
  }

  protected escrowStatus(payment: PaymentHistoryView): PaymentEscrowStatusView | null {
    return this.paymentEscrowStatuses()[payment.id] ?? null;
  }

  protected canReleaseEscrow(payment: PaymentHistoryView): boolean {
    const status = this.escrowStatus(payment);
    if (status?.canRelease !== undefined) return status.canRelease;
    return ['HELD', 'PENDING', 'EN_ATTENTE'].includes((payment.escrowStatus || '').toUpperCase());
  }

  protected canDisputeEscrow(payment: PaymentHistoryView): boolean {
    const status = this.escrowStatus(payment);
    if (status?.canDispute !== undefined) return status.canDispute;
    return ['HELD', 'PENDING', 'EN_ATTENTE'].includes((payment.escrowStatus || '').toUpperCase());
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
    const currentPassword = this.passwordForm.currentPassword.trim();
    const newPassword = this.passwordForm.newPassword.trim();

    if (this.hasLocalPassword() && currentPassword.length < 8) {
      const message = 'Renseignez votre mot de passe actuel.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    if (newPassword.length < 8) {
      const message = 'Le nouveau mot de passe doit contenir au moins 8 caracteres.';
      this.errorMessage.set(message);
      this.feedback.error(message);
      return;
    }

    const hadLocalPassword = this.hasLocalPassword();
    this.isSavingPassword.set(true);
    this.errorMessage.set(null);
    this.authService
      .changeMyPassword({
        currentPassword: hadLocalPassword ? currentPassword : undefined,
        newPassword,
      })
      .pipe(finalize(() => this.isSavingPassword.set(false)))
      .subscribe({
        next: () => {
          this.passwordForm.currentPassword = '';
          this.passwordForm.newPassword = '';
          this.profile.update((profile) => (profile ? { ...profile, hasPassword: true } : profile));
          this.feedback.success(
            hadLocalPassword
              ? 'Mot de passe mis a jour avec succes.'
              : 'Mot de passe local cree avec succes.',
          );
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

  private loadPaymentActivity(): void {
    if (!this.currentUser()) return;
    this.isLoadingPayments.set(true);
    this.authService
      .listPaymentHistory()
      .pipe(
        catchError(() => of([])),
        finalize(() => this.isLoadingPayments.set(false)),
      )
      .subscribe((payments) => {
        const paymentsList = Array.isArray(payments) ? payments : [];
        this.paymentHistory.set(paymentsList);
        paymentsList.slice(0, 6).forEach((payment) => this.loadPaymentEscrowStatus(payment.id));
      });

    // Only load withdrawals for professionals
    if (this.isProfessionalSettings()) {
      this.authService
        .listWithdrawalRequests()
        .pipe(catchError(() => of([])))
        .subscribe((withdrawals) => {
          const withdrawalsList = Array.isArray(withdrawals) ? withdrawals : [];
          this.withdrawalRequests.set(withdrawalsList);
        });
    }
  }

  private loadPaymentEscrowStatus(paymentId: string): void {
    if (!paymentId) return;
    this.authService
      .getPaymentEscrowStatus(paymentId)
      .pipe(catchError(() => of(null)))
      .subscribe((status) => {
        if (!status) return;
        this.paymentEscrowStatuses.update((statuses) => ({
          ...statuses,
          [paymentId]: status,
        }));
      });
  }

  private patchPayment(updated: PaymentHistoryView): void {
    this.paymentHistory.update((payments) =>
      payments.map((payment) => (payment.id === updated.id ? { ...payment, ...updated } : payment)),
    );
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
    this.profileForm.phoneNumber = this.displayPhoneNumber()
      ? toSenegalLocalPhoneInput(this.displayPhoneNumber()!)
      : '';
    this.addressForm.address = profile?.adresse || '';
    this.cardForm.holderName = profile?.nom || this.currentUser()?.name || '';
    this.waveForm.phoneNumber = this.displayPhoneNumber() || '';
  }

  private resetPaymentForms(): void {
    this.cardForm.cardNumber = '';
    this.cardForm.holderName = this.displayName();
    this.cardForm.expiryMonth = 12;
    this.cardForm.expiryYear = new Date().getFullYear() + 1;
    this.waveForm.phoneNumber = this.displayPhoneNumber() || '';
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

  private parseProfessionalBiography(): {
    specialty: string;
    expertises: string[];
    documents: string[];
  } {
    const biography = this.professionalProfile()?.biographie || '';
    const readLine = (label: string): string => {
      const line = biography
        .split('\n')
        .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
      return line?.split(':').slice(1).join(':').trim() || '';
    };
    const splitList = (value: string): string[] =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return {
      specialty: readLine('Specialite'),
      expertises: splitList(readLine('Expertises')),
      documents: splitList(readLine('Documents')),
    };
  }
}
