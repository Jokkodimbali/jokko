import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-service-proposal-accepted-summary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './service-proposal-accepted-summary.component.html',
  styleUrl: './service-proposal-accepted-summary.component.scss',
})
export class ServiceProposalAcceptedSummaryComponent {
  @Input({ required: true }) avatarAlt = '';
  @Input() avatarUrl = '';
  @Input({ required: true }) initials = '';
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) descriptionPrefix = '';
  @Input({ required: true }) descriptionStrong = '';
  @Input({ required: true }) pricePrimaryLabel = '';
  @Input({ required: true }) pricePrimaryValue = '';
  @Input() pricePrimarySuffix = '';
  @Input({ required: true }) priceSecondaryLabel = '';
  @Input({ required: true }) priceSecondaryValue = '';
  @Input({ required: true }) dateValue = '';
  @Input({ required: true }) addressValue = '';
  @Input({ required: true }) actionIcon = 'message-circle';
  @Input({ required: true }) actionLabel = '';

  @Output() action = new EventEmitter<void>();
}
