import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-tender-price-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: ` <div class="price-control" [class.compact]="compact">
    <label
      ><span *ngIf="showLabel">{{ label }}</span
      ><span class="price-input"
        ><input
          type="text"
          inputmode="numeric"
          [ngModel]="amount | number: '1.0-0'"
          (ngModelChange)="update($event)"
          [disabled]="disabled"
          min="500"
          max="99999999"
          step="1"
          required
          aria-label="Montant en FCFA"
        /><strong>FCFA</strong></span
      ></label
    >
    <div class="adjust">
      <button type="button" [disabled]="disabled || amount <= 500" (click)="update(amount - step)">
        − Diminuer</button
      ><button
        type="button"
        [disabled]="disabled || amount >= 99999999"
        (click)="update(amount + step)"
      >
        + Augmenter
      </button>
    </div>
    <label class="step"
      >Palier
      <input
        type="range"
        min="100"
        max="2000"
        step="100"
        [(ngModel)]="step"
        [disabled]="disabled"
      /><span>{{ step | number: '1.0-0' }} FCFA</span></label
    >
  </div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .price-control {
        padding: 0;
      }
      label {
        display: block;
        font-weight: 700;
        color: #294056;
      }
      .price-input {
        display: flex;
        align-items: baseline;
        justify-content: flex-start;
        gap: 10px;
        margin: 12px 0;
      }
      .price-input input {
        width: 100%;
        min-width: 0;
        max-width: 195px;
        background: transparent;
        border: 0;
        color: #287644;
        font: 800 52px var(--font-app, system-ui);
        text-align: left;
      }
      .price-input strong {
        font-size: 14px;
        color: #23853d;
      }
      .adjust {
        display: flex;
        gap: 12px;
      }
      .adjust button {
        flex: 1;
        padding: 16px;
        border: 0;
        background: #fceced;
        border-radius: 16px;
        color: #ef4141;
        font-weight: 700;
        cursor: pointer;
      }
      .adjust button:last-child {
        background: #d4eadb;
        color: #2f9e50;
      }
      .step {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px 16px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #8b919a;
        font-size: 12px;
        margin-top: 18px;
      }
      .step input {
        grid-column: 1;
        min-width: 40px;
        width: 100%;
        accent-color: #18191f;
      }
      .step span {
        grid-column: 2;
        grid-row: 2;
        white-space: nowrap;
        padding: 8px 14px;
        border: 1px solid #e0e2e5;
        border-radius: 999px;
        color: #17191f;
        letter-spacing: 0;
      }
      .compact .price-input { margin: 3px 0 13px; }
      .compact .price-input input { max-width: 166px; font-size: 43px; line-height: 1.1; }
      .compact .adjust { gap: 10px; }
      .compact .adjust button { padding: 13px 8px; border-radius: 14px; }
      .compact .step { display: flex; gap: 10px; margin-top: 13px; }
      .compact .step input { flex: 1; min-width: 30px; width: auto; }
      .compact .step span { padding: 6px 12px; }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid #865221;
        outline-offset: 3px;
      }
    `,
  ],
})
export class TenderPriceControlComponent {
  @Input() amount = 10000;
  @Input() label = 'Votre offre de prix';
  @Input() showLabel = true;
  @Input() compact = false;
  @Input() disabled = false;
  @Output() amountChange = new EventEmitter<number>();
  protected step = 500;
  protected update(value: number | string | null) {
    const numeric = typeof value === 'string' ? Number(value.replace(/\D/g, '')) : value;
    this.amountChange.emit(Math.min(99999999, Math.max(500, Math.round(numeric ?? 500))));
  }
}
