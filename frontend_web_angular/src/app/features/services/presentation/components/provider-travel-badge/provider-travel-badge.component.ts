import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-provider-travel-badge',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './provider-travel-badge.component.html',
  styleUrl: './provider-travel-badge.component.scss',
})
export class ProviderTravelBadgeComponent {
  @Input({ required: true }) label = '';
  @Input() imageUrl: string | null = null;
  @Input() icons: string[] = [];
  @Input() variant: 'movement' | 'vehicle' = 'movement';
  @Input() tone: 'CLIENT_SE_DEPLACE' | 'PRESTATAIRE_SE_DEPLACE' | 'TRANSPORT_COLIS' | 'DEFAULT' = 'DEFAULT';
  @Input() overlay = false;
}
