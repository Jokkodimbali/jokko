import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ServiceProposalFormatService {
  defaultAppointmentDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return date;
  }

  toDateInputValue(date: Date): string {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  toIsoDateTime(value: string): string | null {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  formatProposalDate(value: string, fallbackLabel: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return fallbackLabel;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .toUpperCase()
      .replace(',', '');
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
      .format(value || 0)
      .replace(/\s/g, ' ');
  }

  formatDecimal(value: number, digits = 1): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    })
      .format(value || 0)
      .replace(/\s/g, ' ');
  }

  toPositiveAmount(value: number | null | undefined): number | null {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : null;
  }

  formatAcceptedDateTime(value: string): string {
    return `${this.formatAcceptedDate(value)} a ${this.formatAcceptedTime(value)}`;
  }

  formatAcceptedDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .replace('.', '');
  }

  formatAcceptedTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Heure a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replace(':', 'h');
  }

  truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 4)}....` : value;
  }
}
