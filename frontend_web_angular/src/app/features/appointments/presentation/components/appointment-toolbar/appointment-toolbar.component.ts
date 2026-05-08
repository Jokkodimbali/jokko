import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-appointment-toolbar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './appointment-toolbar.component.html',
  styleUrl: './appointment-toolbar.component.scss',
})
export class AppointmentToolbarComponent {
  @Input({ required: true }) futureCount = 0;
  @Input({ required: true }) doneCount = 0;
  @Input() activeTab: 'future' | 'done' = 'future';
  @Input() search = '';
  @Output() activeTabChange = new EventEmitter<'future' | 'done'>();
  @Output() searchChange = new EventEmitter<string>();
}
