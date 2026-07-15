import { Injectable } from '@angular/core';
import { GoogleMapsCoordinate } from '../../../../../shared/maps/google-maps-loader.service';

export interface ParcelDraft {
  id: string;
  number: string;
  description: string;
}

export interface ParcelContactDraft {
  name: string;
  phone: string;
}

export interface ParcelReservationNotesInput {
  isParcelDeliveryService: boolean;
  parcels: ParcelDraft[];
  note: string;
  pickupContact: ParcelContactDraft;
  dropoffContact: ParcelContactDraft;
  deliveryType: string;
  categoryLabel: string;
  pickupAddress: string;
  dropoffAddress: string;
  pricingNotes: string[];
}

@Injectable({ providedIn: 'root' })
export class ServiceProposalParcelService {
  createParcelDraft(index: number, usedNumbers: Set<string>): ParcelDraft {
    return {
      id: `parcel-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
      number: this.generateParcelNumber(index, usedNumbers),
      description: '',
    };
  }

  reservationNotes(input: ParcelReservationNotesInput): string[] {
    if (!input.isParcelDeliveryService) {
      return [];
    }

    const parcelLines = input.parcels
      .filter((parcel) => parcel.description.trim())
      .map((parcel, index) => {
        const description = this.compactText(parcel.description);
        return `Colis ${index + 1} (${parcel.number}): ${description}.`;
      });
    const note = this.compactText(input.note);

    return [
      `Type de livraison: ${this.compactText(input.deliveryType) || input.categoryLabel}.`,
      `Expediteur: ${this.compactText(input.pickupContact.name)} - ${this.compactText(input.pickupContact.phone)}.`,
      `Depart colis: ${this.compactText(input.pickupAddress)}.`,
      `Destinataire: ${this.compactText(input.dropoffContact.name)} - ${this.compactText(input.dropoffContact.phone)}.`,
      `Arrivee destinataire: ${this.compactText(input.dropoffAddress)}.`,
      ...input.pricingNotes,
      ...parcelLines,
      note ? `Note livraison: ${note}.` : '',
    ].filter(Boolean);
  }

  isValidContact(contact: ParcelContactDraft): boolean {
    const name = contact.name.trim().replace(/\s+/g, ' ');
    const phoneDigits = contact.phone.replace(/\D/g, '');
    return name.length >= 2 && name.length <= 120 && phoneDigits.length >= 9 && phoneDigits.length <= 15;
  }

  normalizeCoordinate(coordinate: GoogleMapsCoordinate | null): GoogleMapsCoordinate | null {
    const latitude = Number(coordinate?.latitude);
    const longitude = Number(coordinate?.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    return { latitude, longitude };
  }

  estimateRoadDistanceMeters(
    origin: GoogleMapsCoordinate,
    destination: GoogleMapsCoordinate,
  ): number {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const originLat = toRadians(origin.latitude);
    const destinationLat = toRadians(destination.latitude);
    const deltaLat = toRadians(destination.latitude - origin.latitude);
    const deltaLng = toRadians(destination.longitude - origin.longitude);
    const haversine =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLng / 2) ** 2;
    const straightDistance =
      2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return Math.max(1, Math.round(straightDistance * 1.25));
  }

  private generateParcelNumber(index: number, usedNumbers: Set<string>): string {
    let attempts = 0;
    let number = '';
    do {
      number = String(Math.floor(10000 + Math.random() * 90000));
      attempts += 1;
    } while (usedNumbers.has(number) && attempts < 12);

    usedNumbers.add(number);
    return number;
  }

  private compactText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}
