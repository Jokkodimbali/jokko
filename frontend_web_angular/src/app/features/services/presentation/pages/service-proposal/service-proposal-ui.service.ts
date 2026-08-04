import { Injectable } from '@angular/core';
import { ProviderProfileDetail } from '../../../domain/models/services.models';
import { PaymentMethod } from './service-proposal-reservation-builder.service';

export interface PaymentOption {
  id: PaymentMethod;
  label: string;
  mark: string;
  logoUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceProposalUiService {
  readonly paymentOptions: PaymentOption[] = [
    { id: 'WAVE', label: 'Wave', mark: 'W', logoUrl: '/wave.png' },
    {
      id: 'ORANGE_MONEY',
      label: 'Orange Money',
      mark: 'OM',
      logoUrl: '/Orange-Money-logo.png',
    },
    { id: 'VISA', label: 'Carte bancaire', mark: 'VISA', logoUrl: '/logo vissa.avif' },
  ];

  priceSectionTitle(isFixedPriceService: boolean): string {
    return isFixedPriceService ? 'Tarif fixe du service' : 'Proposez un prix au prestataire';
  }

  offerFieldLabel(isFixedPriceService: boolean): string {
    return isFixedPriceService ? 'Tarif fixe' : 'Votre offre';
  }

  summaryPriceLabel(isFixedPriceService: boolean): string {
    return isFixedPriceService ? 'PRIX FIXE' : 'PRIX PROPOSE';
  }

  checkoutTotalLabel(isFixedPriceService: boolean): string {
    return isFixedPriceService ? 'TOTAL A PAYER' : 'TOTAL A AUTORISER';
  }

  submitButtonLabel(input: {
    isSubmitting: boolean;
    hasCustomServiceName: boolean;
    isFixedPriceService: boolean;
    isOfferAdjusted: boolean;
  }): string {
    if (input.isSubmitting) {
      if (input.hasCustomServiceName) {
        return "Envoi de l'offre...";
      }

      return input.isFixedPriceService || !input.isOfferAdjusted
        ? 'Creation de la reservation...'
        : 'Envoi de la contre-offre...';
    }

    if (input.hasCustomServiceName) {
      return "Envoyer l'offre";
    }

    return input.isFixedPriceService || !input.isOfferAdjusted
      ? 'Finaliser la reservation'
      : 'Contre-offre';
  }

  submitButtonVisualLabel(input: {
    isSubmitting: boolean;
    submitButtonLabel: string;
    hasCustomServiceName: boolean;
    isOfferAdjusted: boolean;
  }): string {
    return input.isSubmitting
      ? input.submitButtonLabel
      : input.hasCustomServiceName
        ? "Envoyer l'offre"
        : input.isOfferAdjusted
          ? 'Contre-offre'
          : 'Finaliser la reservation';
  }

  ratingLabel(detail: ProviderProfileDetail | null): string {
    const profile = detail?.profile;
    if (!profile) return 'Nouveau';
    const rating = Number(profile.noteGlobale || 0).toFixed(1);
    return `${rating}  ${profile.nombreAvis || 0} mission`;
  }

  formattedDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date a choisir';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .toUpperCase()
      .replace('.', '');
  }

  formattedTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Heure a choisir';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replace(':', 'h');
  }
}
