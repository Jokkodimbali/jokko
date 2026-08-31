import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

export type PharmacyOrderView = {
  id: string;
  status: string;
  medicineAmount: number | null;
  deliveryRequested: boolean;
  deliveryAmount: number | null;
  deliveryDistanceKm: number | null;
  deliveryAddress: string | null;
  totalAmount: number;
  pharmacyNote: string | null;
  unavailableItems: string[];
  medicineItems: PharmacyOrderMedicineItem[];
  validatedAt: string | null;
  paidAt: string | null;
  payment: {
    id: string;
    status: string;
    method: 'WAVE' | 'ORANGE_MONEY' | 'CARD';
    processedAt: string | null;
  } | null;
  deliveryReservation: {
    id: string;
    status: string;
    courier: {
      professionalId: string;
      name: string;
      avatarUrl: string | null;
    };
  } | null;
  medicalReservation: {
    id: string;
    scheduledAt: string;
    prescription: { acts: string[]; vaccines: string[]; treatments: string[] };
    prescriber: {
      name: string;
      avatarUrl: string | null;
      specialty: string;
      rating: number;
      totalReviews: number;
    };
  };
  client: { id: string; nom: string };
  pharmacy: { id: string; name: string; userId: string };
  createdAt: string;
};

export type PharmacyOrderMedicineItem = {
  position: number;
  name: string;
  isAvailable: boolean;
  price: number | null;
};

export type NearbyPharmacyView = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  rating: number;
  totalReviews: number;
};

export type PharmacyOrderDecision = {
  status: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';
  pharmacyNote?: string;
  medicineItems: Array<{
    position: number;
    name: string;
    isAvailable: boolean;
    price?: number;
  }>;
};

export type PharmacyOrderPaymentView = {
  id: string;
  pharmacyOrderId: string;
  amount: number;
  method: 'WAVE' | 'ORANGE_MONEY' | 'CARD';
  status: string;
  transactionReference: string;
  gatewayReference: string | null;
  paymentUrl: string | null;
  processedAt: string | null;
};

export type PharmacyDeliveryOfferView = PharmacyOrderView & {
  distanceKm: number;
  deliveryDistanceKm: number;
  deliveryAmount: number;
  pricePerKm: number;
};

@Injectable({ providedIn: 'root' })
export class PharmacyOrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/pharmacy-orders`;

  get(orderId: string): Observable<PharmacyOrderView> {
    return this.http
      .get<ApiResponse<PharmacyOrderView>>(`${this.apiUrl}/${orderId}`)
      .pipe(map(unwrapApiResponse));
  }

  list(): Observable<PharmacyOrderView[]> {
    return this.http
      .get<ApiResponse<PharmacyOrderView[]>>(this.apiUrl)
      .pipe(map(unwrapApiResponse));
  }

  getAccess(): Observable<{ isPharmacy: boolean }> {
    return this.http
      .get<ApiResponse<{ isPharmacy: boolean }>>(`${this.apiUrl}/access`)
      .pipe(map(unwrapApiResponse));
  }

  validate(orderId: string, decision: PharmacyOrderDecision): Observable<PharmacyOrderView> {
    return this.http
      .patch<ApiResponse<PharmacyOrderView>>(`${this.apiUrl}/${orderId}/validation`, decision)
      .pipe(map(unwrapApiResponse));
  }

  configureDelivery(orderId: string, deliveryRequested: boolean): Observable<PharmacyOrderView> {
    return this.http
      .patch<
        ApiResponse<PharmacyOrderView>
      >(`${this.apiUrl}/${orderId}/delivery-option`, { deliveryRequested })
      .pipe(map(unwrapApiResponse));
  }

  initiatePayment(
    orderId: string,
    method: 'WAVE' | 'ORANGE_MONEY' | 'CARD',
    deliveryRequested = false,
  ): Observable<PharmacyOrderPaymentView> {
    return this.http
      .post<ApiResponse<PharmacyOrderPaymentView>>(
        `${this.apiUrl}/${orderId}/payment`,
        {
          method,
          successUrl: this.absoluteUrl(
            deliveryRequested
              ? `/pharmacy-orders/${orderId}/delivery`
              : `/pharmacy-orders/${orderId}`,
          ),
          cancelUrl: this.absoluteUrl(`/pharmacy-orders/${orderId}/payment`),
        },
        {
          headers: {
            'Idempotency-Key': `pharmacy-payment-${orderId}-${method}`,
          },
        },
      )
      .pipe(map(unwrapApiResponse));
  }

  confirmMockPayment(orderId: string): Observable<PharmacyOrderPaymentView> {
    return this.http
      .post<
        ApiResponse<PharmacyOrderPaymentView>
      >(`${this.apiUrl}/${orderId}/payment/mock-confirm`, {})
      .pipe(map(unwrapApiResponse));
  }

  getDeliveryOffer(orderId: string): Observable<PharmacyDeliveryOfferView> {
    return this.http
      .get<ApiResponse<PharmacyDeliveryOfferView>>(`${this.apiUrl}/${orderId}/delivery-offer`)
      .pipe(map(unwrapApiResponse));
  }

  acceptDelivery(orderId: string): Observable<PharmacyOrderView> {
    return this.http
      .post<ApiResponse<PharmacyOrderView>>(`${this.apiUrl}/${orderId}/delivery/accept`, {})
      .pipe(map(unwrapApiResponse));
  }

  listNearby(input: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  }): Observable<NearbyPharmacyView[]> {
    const params: Record<string, string> = {
      latitude: String(input.latitude),
      longitude: String(input.longitude),
    };
    if (input.radiusKm !== undefined) params['radiusKm'] = String(input.radiusKm);
    return this.http
      .get<ApiResponse<NearbyPharmacyView[]>>(`${this.apiUrl}/nearby`, { params })
      .pipe(map(unwrapApiResponse));
  }

  create(input: {
    medicalReservationId: string;
    pharmacyId: string;
  }): Observable<PharmacyOrderView> {
    return this.http
      .post<ApiResponse<PharmacyOrderView>>(this.apiUrl, input)
      .pipe(map(unwrapApiResponse));
  }

  private absoluteUrl(path: string): string {
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
  }
}
