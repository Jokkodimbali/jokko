import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { AdminKycProfile } from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-kyc-validation-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-kyc-validation-panel.component.html',
  styleUrl: './admin-kyc-validation-panel.component.scss',
})
export class AdminKycValidationPanelComponent implements OnChanges {
  @Input({ required: true }) profiles: AdminKycProfile[] = [];
  @Input() isLoading = false;
  @Input() actionId: string | null = null;
  @Output() approve = new EventEmitter<string>();
  @Output() reject = new EventEmitter<{ profileId: string; reason: string }>();
  @Output() detailRequested = new EventEmitter<string>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly rejectionProfileId = signal<string | null>(null);
  protected rejectionReason = '';
  protected readonly selectedProfile = computed(
    () =>
      this.profiles.find((profile) => profile.id === this.selectedId()) ?? this.profiles[0] ?? null,
  );

  ngOnChanges(): void {
    if (!this.profiles.some((profile) => profile.id === this.selectedId())) {
      this.selectedId.set(this.profiles[0]?.id ?? null);
    }
  }

  protected select(profileId: string): void {
    this.selectedId.set(profileId);
    this.detailRequested.emit(profileId);
  }

  protected approveSelected(): void {
    const profile = this.selectedProfile();
    if (profile) this.approve.emit(profile.id);
  }

  protected rejectSelected(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    this.rejectionProfileId.set(profile.id);
    this.rejectionReason = '';
  }

  protected closeRejectModal(): void {
    this.rejectionProfileId.set(null);
    this.rejectionReason = '';
  }

  protected confirmReject(): void {
    const profileId = this.rejectionProfileId();
    const reason = this.rejectionReason.trim();
    if (!profileId || !reason) return;
    this.reject.emit({ profileId, reason });
    this.closeRejectModal();
  }

  protected title(profile: AdminKycProfile): string {
    return profile.nomEntreprise || profile.utilisateur.nom;
  }

  protected subtitle(profile: AdminKycProfile): string {
    return profile.biographie || profile.ville || 'Profil professionnel';
  }

  protected initials(profile: AdminKycProfile): string {
    return userInitials(this.title(profile));
  }

  protected formatDate(profile: AdminKycProfile): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(profile.creeLe));
  }

  protected selectedProfileTitle(): string {
    const profile = this.selectedProfile();
    return profile ? this.title(profile) : 'ce dossier';
  }
}
