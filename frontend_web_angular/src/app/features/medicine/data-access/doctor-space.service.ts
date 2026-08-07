import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  BackendProfessionalAvailability,
  BackendProfessionalDetailService,
  BackendProfessionalPortfolioItem,
  BackendProfessionalProfile,
  Category,
  CategoryStructure,
  ServiceTravelMode,
  ProfessionalVehicleType,
  ServiceSubCategory,
} from '../../services/domain/models/services.models';
import { BackendReservation } from '../../appointments/domain/appointments.models';

export type DoctorWalletTransaction = {
  id: string;
  title: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  type: string;
  status: 'TERMINE' | 'EN_ATTENTE';
  reference: string;
};

export type DoctorWalletPendingEscrow = {
  paymentId: string;
  reservationId: string;
  serviceName: string;
  clientName: string;
  date: string;
  amount: number;
  netAmount: number;
  reservationStatus: string;
  canRequestRelease: boolean;
};

export type DoctorWalletView = {
  professionalId: string;
  availableBalance: number;
  totalCollected: number;
  monthlyRevenue: {
    amount: number;
    changePercent: number;
    consultationCount: number;
    teleconsultationCount: number;
    refundedCancellationCount: number;
  };
  transactions: DoctorWalletTransaction[];
  pendingEscrow: DoctorWalletPendingEscrow[];
};

export type ProfessionalUploadView = {
  fileUrl: string;
  imageUrl: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

type CategoryStructureApiView = Omit<CategoryStructure, 'subCategories'> & {
  subCategories?: Array<ServiceSubCategory & { isActive?: boolean }>;
  sousCategories?: Array<ServiceSubCategory & { isActive?: boolean }>;
};

export type PatientMedicalTreatment = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  startedAt: string | null;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientMedicalProfile = {
  id: string | null;
  bloodGroup: string | null;
  rhesus: string | null;
  weightKg: number | null;
  heightCm: number | null;
  referenceDoctorName: string | null;
  profession: string | null;
  allergies: string[];
  conditions: string[];
  bmi: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  treatments: PatientMedicalTreatment[];
};

@Injectable({
  providedIn: 'root',
})
export class DoctorSpaceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getMyProfile(): Observable<BackendProfessionalProfile> {
    return this.http
      .get<ApiResponse<BackendProfessionalProfile>>(`${this.apiUrl}/professionals/me`)
      .pipe(map(unwrapApiResponse));
  }

  createMyProfessionalProfile(data: {
    bio?: string | null;
    companyName?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    vehicleType?: ProfessionalVehicleType;
  }): Observable<BackendProfessionalProfile> {
    return this.http
      .post<ApiResponse<BackendProfessionalProfile>>(`${this.apiUrl}/professionals/profile`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateMyProfessionalProfile(data: {
    bio?: string | null;
    companyName?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    vehicleType?: ProfessionalVehicleType;
  }): Observable<BackendProfessionalProfile> {
    return this.http
      .patch<ApiResponse<BackendProfessionalProfile>>(`${this.apiUrl}/professionals/me`, data)
      .pipe(map(unwrapApiResponse));
  }

  submitMyKyc(data: {
    idCardUrl: string;
    idCardUrlVerso?: string;
  }): Observable<BackendProfessionalProfile> {
    return this.http
      .patch<
        ApiResponse<BackendProfessionalProfile>
      >(`${this.apiUrl}/professionals/me/kyc/submit`, data)
      .pipe(map(unwrapApiResponse));
  }

  createPortfolioItem(data: {
    title: string;
    description?: string | null;
    imageUrl: string;
  }): Observable<BackendProfessionalPortfolioItem> {
    return this.http
      .post<
        ApiResponse<BackendProfessionalPortfolioItem>
      >(`${this.apiUrl}/professionals/me/portfolio`, data)
      .pipe(map(unwrapApiResponse));
  }

  deletePortfolioItem(itemId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.apiUrl}/professionals/me/portfolio/${itemId}`)
      .pipe(map(() => undefined));
  }

  uploadProfessionalAsset(file: File): Observable<ProfessionalUploadView> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<
        ApiResponse<ProfessionalUploadView>
      >(`${this.apiUrl}/professionals/me/uploads`, formData)
      .pipe(map(unwrapApiResponse));
  }

  listAvailabilities(profileId: string): Observable<BackendProfessionalAvailability[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalAvailability[]>
      >(`${this.apiUrl}/professionals/${profileId}/availabilities`)
      .pipe(map(unwrapApiResponse));
  }

  listMyAvailabilities(): Observable<BackendProfessionalAvailability[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalAvailability[]>
      >(`${this.apiUrl}/professionals/me/availabilities`)
      .pipe(map(unwrapApiResponse));
  }

  listServices(profileId: string): Observable<BackendProfessionalDetailService[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalDetailService[]>
      >(`${this.apiUrl}/professionals/${profileId}/services`)
      .pipe(map(unwrapApiResponse));
  }

  listPortfolio(profileId: string): Observable<BackendProfessionalPortfolioItem[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalPortfolioItem[]>
      >(`${this.apiUrl}/professionals/${profileId}/portfolio`)
      .pipe(map(unwrapApiResponse));
  }

  listMyServices(): Observable<BackendProfessionalDetailService[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalDetailService[]>
      >(`${this.apiUrl}/professionals/me/services`)
      .pipe(map(unwrapApiResponse));
  }

  listCategories(): Observable<Category[]> {
    return this.http
      .get<ApiResponse<Category[]>>(`${this.apiUrl}/categories`, {
        params: { page: '1', limit: '100' },
      })
      .pipe(map(unwrapApiResponse));
  }

  listCategoryStructure(): Observable<CategoryStructure[]> {
    return this.http
      .get<ApiResponse<CategoryStructureApiView[]>>(`${this.apiUrl}/categories/structure`)
      .pipe(
        map(unwrapApiResponse),
        map((categories) =>
          categories.map((category) => ({
            ...category,
            subCategories: (category.subCategories ?? category.sousCategories ?? []).map(
              (subCategory) => ({
                ...subCategory,
                estActive: subCategory.estActive ?? subCategory.isActive ?? true,
              }),
            ),
          })),
        ),
      );
  }

  listMyReservations(): Observable<BackendReservation[]> {
    return this.http
      .get<ApiResponse<BackendReservation[]>>(`${this.apiUrl}/reservations/my`, {
        params: { scope: 'PRESTATAIRE' },
      })
      .pipe(map(unwrapApiResponse));
  }

  getReservationById(reservationId: string): Observable<BackendReservation> {
    return this.http
      .get<ApiResponse<BackendReservation>>(`${this.apiUrl}/reservations/${reservationId}`)
      .pipe(map(unwrapApiResponse));
  }

  cancelReservation(reservationId: string, reason: string): Observable<BackendReservation> {
    return this.http
      .patch<
        ApiResponse<BackendReservation>
      >(`${this.apiUrl}/reservations/${reservationId}/cancel`, { reason })
      .pipe(map(unwrapApiResponse));
  }

  getPatientMedicalProfile(clientId: string): Observable<PatientMedicalProfile> {
    return this.http
      .get<
        ApiResponse<PatientMedicalProfile>
      >(`${this.apiUrl}/users/patients/${clientId}/medical-profile`)
      .pipe(map(unwrapApiResponse));
  }

  getWallet(): Observable<DoctorWalletView> {
    return this.http
      .get<ApiResponse<DoctorWalletView>>(`${this.apiUrl}/payments/wallet`)
      .pipe(map(unwrapApiResponse));
  }

  requestWithdrawal(data: { amount: number; method: 'WAVE' | 'ORANGE_MONEY' }): Observable<{
    withdrawalId: string;
    amount: number;
    method: string;
    status: string;
    requestedAt: string;
  }> {
    return this.http
      .post<
        ApiResponse<{
          withdrawalId: string;
          amount: number;
          method: string;
          status: string;
          requestedAt: string;
        }>
      >(`${this.apiUrl}/payments/withdraw`, data)
      .pipe(map(unwrapApiResponse));
  }

  releaseEscrow(paymentId: string): Observable<{
    payment: unknown;
    escrowReleased: boolean;
  }> {
    return this.http
      .patch<
        ApiResponse<{ payment: unknown; escrowReleased: boolean }>
      >(`${this.apiUrl}/payments/${paymentId}/escrow/release`, {})
      .pipe(map(unwrapApiResponse));
  }

  createService(data: {
    categoryId: string;
    name: string;
    description: string;
    imageUrl?: string | null;
    price: number;
    priceType: 'FIXE' | 'NEGOCIABLE';
    travelMode?: ServiceTravelMode;
    durationMinutes: number;
    pauseMinutes?: number;
    isRequired: boolean;
  }): Observable<BackendProfessionalDetailService> {
    return this.http
      .post<
        ApiResponse<BackendProfessionalDetailService>
      >(`${this.apiUrl}/professionals/me/services`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateService(
    serviceId: string,
    data: {
      name?: string;
      description?: string;
      imageUrl?: string | null;
      price?: number;
      priceType?: 'FIXE' | 'NEGOCIABLE';
      travelMode?: ServiceTravelMode;
      durationMinutes?: number;
      pauseMinutes?: number;
      isRequired?: boolean;
    },
  ): Observable<BackendProfessionalDetailService> {
    return this.http
      .patch<
        ApiResponse<BackendProfessionalDetailService>
      >(`${this.apiUrl}/professionals/me/services/${serviceId}`, data)
      .pipe(map(unwrapApiResponse));
  }

  deleteService(serviceId: string): Observable<void> {
    return this.http
      .delete<
        ApiResponse<BackendProfessionalDetailService>
      >(`${this.apiUrl}/professionals/me/services/${serviceId}`)
      .pipe(map(() => undefined));
  }

  createAvailability(data: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }): Observable<BackendProfessionalAvailability> {
    return this.http
      .post<
        ApiResponse<BackendProfessionalAvailability>
      >(`${this.apiUrl}/professionals/me/availabilities`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateAvailability(
    availabilityId: string,
    data: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    },
  ): Observable<BackendProfessionalAvailability> {
    return this.http
      .patch<
        ApiResponse<BackendProfessionalAvailability>
      >(`${this.apiUrl}/professionals/me/availabilities/${availabilityId}`, data)
      .pipe(map(unwrapApiResponse));
  }

  deleteAvailability(availabilityId: string): Observable<void> {
    return this.http
      .delete<
        ApiResponse<BackendProfessionalAvailability>
      >(`${this.apiUrl}/professionals/me/availabilities/${availabilityId}`)
      .pipe(map(() => undefined));
  }
}
