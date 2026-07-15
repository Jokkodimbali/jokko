import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppointmentDetailFormatService {
  formatDistance(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 1,
    }).format(value)} km`;
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    })
      .format(value || 0)
      .replace(/\s/g, ' ')} FCFA`;
  }

  formatTimeFromValue(value: string | null | undefined): string {
    if (!value) return '--h--';
    return this.formatTimeFromDate(new Date(value));
  }

  formatTimeFromDate(value: Date): string {
    if (Number.isNaN(value.getTime())) return '--h--';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(value)
      .replace(':', 'h');
  }

  formatLongDateTime(value: string | null | undefined): string {
    if (!value) return 'date non renseignee';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'date non renseignee';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replace(',', ' a')
      .replace(':', 'h');
  }

  toDateTimeLocalValue(value: Date): string {
    if (Number.isNaN(value.getTime())) {
      return this.toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    }

    const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  toCalendarDate(value: Date): string {
    return value
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  escapeCalendarText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  providerLocationHelpMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('permission denied')) {
      return "Autorisez la localisation pour partager automatiquement votre position. Cliquez sur le cadenas de la barre d'adresse, choisissez Localisation > Autoriser, puis reessayez.";
    }

    if (message.includes('timeout')) {
      return "La position GPS prend trop de temps. Activez le GPS, rapprochez-vous d'une zone couverte, puis reessayez.";
    }

    if (message.includes('unavailable')) {
      return "La geolocalisation n'est pas disponible sur cet appareil. Activez le GPS ou utilisez un navigateur compatible.";
    }

    if (message.includes('outside Senegal')) {
      return 'La position detectee est hors du Senegal. Verifiez le GPS avant de demarrer le trajet.';
    }

    if (message.includes('Invalid geolocation coordinates')) {
      return 'La position GPS recue est invalide. Activez la localisation precise puis reessayez.';
    }

    return "Impossible de recuperer votre position exacte. Autorisez la localisation GPS du navigateur et reessayez.";
  }
}
