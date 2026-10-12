import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** The same material article editor is used during negotiation and after booking. */
@Component({
  selector: 'app-material-quote-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './material-quote-form.component.html',
  styleUrl: './material-quote-form.component.scss',
})
export class MaterialQuoteFormComponent {
  @Input() designation = '';
  @Input() quantity = 1;
  @Input() roleLabel = '';
  @Input() busy = false;
  @Input() submitLabel = 'Valider';
  @Output() readonly designationChange = new EventEmitter<string>();
  @Output() readonly quantityChange = new EventEmitter<number>();
  @Output() readonly submitted = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  protected changeQuantity(delta: number): void {
    this.quantityChange.emit(Math.max(1, Math.min(1000, this.quantity + delta)));
  }
}
