import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { AdminMedicalValidation } from '../../../data-access/admin.models';

@Component({
  selector: 'app-admin-medical-credentials-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './admin-medical-credentials-panel.component.html',
  styleUrl: './admin-medical-credentials-panel.component.scss',
})
export class AdminMedicalCredentialsPanelComponent implements OnChanges {
  @Input({ required: true }) profiles: AdminMedicalValidation[] = [];
  @Input() actionId: string | null = null;
  @Output() certify = new EventEmitter<string>();
  @Output() reject = new EventEmitter<{ profileId: string; reason: string }>();

  protected readonly selectedId = signal<string | null>(null);
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
  }

  protected certifySelected(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    this.certify.emit(profile.id);
  }

  protected rejectSelected(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    const reason = window.prompt('Motif de suspension du dossier medecin');
    if (!reason?.trim()) return;
    this.reject.emit({ profileId: profile.id, reason: reason.trim() });
  }

  protected initials(profile: AdminMedicalValidation): string {
    return userInitials(profile.name);
  }

  protected formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
