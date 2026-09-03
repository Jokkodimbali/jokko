import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

export type MaterialOrderItem = {
  position: number;
  name: string;
  quantity: number;
  isAvailable: boolean;
  unitPrice: number | null;
};

export type MaterialOrderView = {
  id: string;
  status: string;
  materialAmount: number | null;
  deliveryRequested: boolean;
  deliveryAmount: number | null;
  deliveryDistanceKm: number | null;
  deliveryAddress: string | null;
  totalAmount: number;
  note: string | null;
  unavailableItems: string[];
  items: MaterialOrderItem[];
  validatedAt: string | null;
  paidAt: string | null;
  reservation: {
    id: string;
    scheduledAt: string;
    status: string;
    address: string;
    service: { id: string; nom: string };
    provider: { id: string; name: string };
  } | null;
  client: { id: string; nom: string; adresse: string | null };
  hardwareStore: { id: string; userId: string; name: string };
  createdAt: string;
};

export type NearbyHardwareStore = {
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

export type MaterialOrderDecision = {
  status: 'EN_ATTENTE_PAIEMENT' | 'PARTIELLEMENT_DISPONIBLE' | 'INDISPONIBLE';
  note?: string;
  items: Array<{
    position: number;
    name: string;
    isAvailable: boolean;
    unitPrice?: number;
  }>;
};

export type MaterialOrderPaymentView = {
  id: string;
  materialOrderId: string;
  amount: number;
  method: 'WAVE' | 'ORANGE_MONEY' | 'CARD';
  status: string;
  paymentUrl: string | null;
};

export type MaterialDeliveryOfferView = MaterialOrderView & {
  courierDistanceKm: number;
  pricePerKm: number;
};

export type MaterialOrderEligibility = {
  eligible: boolean;
  materialCount: number;
  existingOrder: { id: string; status: string } | null;
};

@Injectable({ providedIn: 'root' })
export class MaterialOrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/material-orders`;

  listNearby(input: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  }): Observable<NearbyHardwareStore[]> {
    const params: Record<string, string> = {
      latitude: String(input.latitude),
      longitude: String(input.longitude),
    };
    if (input.radiusKm !== undefined) params['radiusKm'] = String(input.radiusKm);
    return this.http
      .get<ApiResponse<NearbyHardwareStore[]>>(`${this.apiUrl}/nearby`, { params })
      .pipe(map(unwrapApiResponse));
  }

  create(reservationId: string, hardwareStoreId: string): Observable<MaterialOrderView> {
    return this.http
      .post<ApiResponse<MaterialOrderView>>(this.apiUrl, { reservationId, hardwareStoreId })
      .pipe(map(unwrapApiResponse));
  }

  list(): Observable<MaterialOrderView[]> {
    return this.http
      .get<ApiResponse<MaterialOrderView[]>>(this.apiUrl)
      .pipe(map(unwrapApiResponse));
  }

  get(orderId: string): Observable<MaterialOrderView> {
    return this.http
      .get<ApiResponse<MaterialOrderView>>(`${this.apiUrl}/${orderId}`)
      .pipe(map(unwrapApiResponse));
  }

  getAccess(): Observable<{ isHardwareStore: boolean }> {
    return this.http
      .get<ApiResponse<{ isHardwareStore: boolean }>>(`${this.apiUrl}/access`)
      .pipe(map(unwrapApiResponse));
  }

  getEligibility(reservationId: string): Observable<MaterialOrderEligibility> {
    return this.http
      .get<ApiResponse<MaterialOrderEligibility>>(`${this.apiUrl}/eligibility/${reservationId}`)
      .pipe(map(unwrapApiResponse));
  }

  validate(orderId: string, decision: MaterialOrderDecision): Observable<MaterialOrderView> {
    return this.http
      .patch<ApiResponse<MaterialOrderView>>(`${this.apiUrl}/${orderId}/validation`, decision)
      .pipe(map(unwrapApiResponse));
  }

  configureDelivery(orderId: string, deliveryRequested: boolean): Observable<MaterialOrderView> {
    return this.http
      .patch<
        ApiResponse<MaterialOrderView>
      >(`${this.apiUrl}/${orderId}/delivery-option`, { deliveryRequested })
      .pipe(map(unwrapApiResponse));
  }

  initiatePayment(
    orderId: string,
    method: 'WAVE' | 'ORANGE_MONEY' | 'CARD',
  ): Observable<MaterialOrderPaymentView> {
    return this.http
      .post<ApiResponse<MaterialOrderPaymentView>>(
        `${this.apiUrl}/${orderId}/payment`,
        {
          method,
          successUrl: this.absoluteUrl(`/material-orders/${orderId}`),
          cancelUrl: this.absoluteUrl(`/material-orders/${orderId}`),
        },
        { headers: { 'Idempotency-Key': `material-payment-${orderId}-${method}` } },
      )
      .pipe(map(unwrapApiResponse));
  }

  confirmMockPayment(orderId: string): Observable<MaterialOrderPaymentView> {
    return this.http
      .post<
        ApiResponse<MaterialOrderPaymentView>
      >(`${this.apiUrl}/${orderId}/payment/mock-confirm`, {})
      .pipe(map(unwrapApiResponse));
  }

  getDeliveryOffer(orderId: string): Observable<MaterialDeliveryOfferView> {
    return this.http
      .get<ApiResponse<MaterialDeliveryOfferView>>(`${this.apiUrl}/${orderId}/delivery-offer`)
      .pipe(map(unwrapApiResponse));
  }

  acceptDelivery(orderId: string): Observable<MaterialOrderView> {
    return this.http
      .post<ApiResponse<MaterialOrderView>>(`${this.apiUrl}/${orderId}/delivery/accept`, {})
      .pipe(map(unwrapApiResponse));
  }

  private absoluteUrl(path: string): string {
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
  }
}
