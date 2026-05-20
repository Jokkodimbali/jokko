import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AdminKycProfile } from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-kyc-validation-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-kyc-validation-panel.component.html',
  styleUrl: './admin-kyc-validation-panel.component.scss',
})
export class AdminKycValidationPanelComponent implements OnChanges {
  @Input({ required: true }) profiles: AdminKycProfile[] = [];
  @Input() isLoading = false;
  @Input() actionId: string | null = null;
  @Output() approve = new EventEmitter<string>();
  @Output() reject = new EventEmitter<{ profileId: string; reason: string }>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedProfile = computed(
    () => this.profiles.find((profile) => profile.id === this.selectedId()) ?? this.profiles[0] ?? null,
  );

  ngOnChanges(): void {
    if (!this.profiles.some((profile) => profile.id === this.selectedId())) {
      this.selectedId.set(this.profiles[0]?.id ?? null);
    }
  }

  protected select(profileId: string): void {
    this.selectedId.set(profileId);
  }

  protected approveSelected(): void {
    const profile = this.selectedProfile();
    if (profile) this.approve.emit(profile.id);
  }

  protected rejectSelected(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    const reason = window.prompt('Motif du rejet du dossier KYC');
    if (!reason?.trim()) return;
    this.reject.emit({ profileId: profile.id, reason: reason.trim() });
  }

  protected title(profile: AdminKycProfile): string {
    return profile.nomEntreprise || profile.utilisateur.nom;
  }

  protected subtitle(profile: AdminKycProfile): string {
    return profile.biographie || profile.ville || 'Profil professionnel';
  }

  protected initials(profile: AdminKycProfile): string {
    return this.title(profile)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected formatDate(profile: AdminKycProfile): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(profile.creeLe));
  }

  protected documents(profile: AdminKycProfile): Array<{ label: string; url: string | null }> {
    return [
      { label: "Piece d'identite recto", url: profile.urlPieceIdentiteRecto },
      { label: "Piece d'identite verso", url: profile.urlPieceIdentiteVerso },
    ];
  }
}
