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
  SavedPaymentMethodType,
  SavedPaymentMethodView,
} from '../../../auth/data-access/auth.service';
import { AUTH_UI_MESSAGES } from '../../../auth/domain/auth-ui.messages';
import { UserProfileDto } from '../../../auth/domain/models/auth.models';

type SettingsSection = 'profile' | 'payment' | 'favorites' | 'reservations';

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
  protected readonly activeSection = signal<SettingsSection>('profile');
  protected readonly isLoading = signal(false);
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingAddress = signal(false);
  protected readonly isSavingAvatar = signal(false);
  protected readonly isSavingPaymentMethod = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isEditingProfile = signal(false);
  protected readonly isEditingAddress = signal(false);
  protected readonly selectedPaymentType = signal<SavedPaymentMethodType>('CARD');
  protected readonly savedPaymentMethods = signal<SavedPaymentMethodView[]>([]);
  protected readonly editingPaymentMethodId = signal<string | null>(null);
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
    if (role === 'ADMIN') return 'Administrateur';
    return 'Client';
  });
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

  ngOnInit(): void {
    if (!this.currentUser()) return;
    this.loadProfile();
    this.loadPaymentMethods();
  }

  protected selectSection(section: SettingsSection): void {
    this.activeSection.set(section);
    if (section === 'payment') {
      this.loadPaymentMethods();
    }
    if (section === 'favorites') {
      this.router.navigate(['/favorites']);
    }
    if (section === 'reservations') {
      this.router.navigate(['/appointments']);
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
}
