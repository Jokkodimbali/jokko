import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, switchMap } from 'rxjs';
import {
  GoogleLoginRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  SendOtpResponseDto,
  SendOtpRequestDto,
  VerifyOtpRequestDto,
  AuthResponseDto,
  UserProfileDto,
} from '../domain/models/auth.models';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { normalizeLoginIdentifier, normalizeSenegalPhoneNumber } from '../domain/auth.validators';

export type SavedPaymentMethodType = 'CARD' | 'WAVE' | 'OTHER';

export interface SavedPaymentMethodView {
  id: string;
  type: SavedPaymentMethodType;
  label: string | null;
  maskedValue: string;
  holderName: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentHistoryView {
  id: string;
  reservationId?: string | null;
  amount?: number;
  montant?: number;
  status?: string;
  statut?: string;
  method?: string;
  methode?: string;
  escrowStatus?: string | null;
  createdAt?: string;
  creeLe?: string;
}

export interface WithdrawalRequestView {
  id?: string;
  withdrawalId?: string;
  professionalId?: string;
  amount: number;
  method: string;
  status: string;
  requestedAt?: string;
  createdAt?: string;
}

export interface PaymentEscrowStatusView {
  paymentId?: string;
  status?: string;
  escrowStatus?: string;
  amount?: number;
  canRelease?: boolean;
  canDispute?: boolean;
}

export interface UserHistoryItemView {
  id: string;
  statut: string;
  dateHeure: string;
  notes: string | null;
  creeLe: string;
  service: {
    id: string;
    nom: string;
    prix: number;
    typePrix: string;
  };
}

export interface MedicalTreatmentView {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  startedAt: string | null;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalProfileView {
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
  treatments: MedicalTreatmentView[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly usersApiUrl = `${environment.apiUrl}/users`;
  private readonly paymentsApiUrl = `${environment.apiUrl}/payments`;

  login(credentials: LoginRequestDto): Observable<AuthResponseDto> {
    const payload: LoginRequestDto = {
      identifier: normalizeLoginIdentifier(credentials.identifier),
      password: credentials.password.trim(),
    };

    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/login`, payload)
      .pipe(map(unwrapApiResponse));
  }

  register(data: RegisterRequestDto): Observable<AuthResponseDto> {
    const payload: RegisterRequestDto = {
      ...data,
      phoneNumber: normalizeSenegalPhoneNumber(data.phoneNumber),
      name: this.normalizeText(data.name),
      email: data.email?.trim() ? data.email.trim().toLowerCase() : undefined,
      password: data.password.trim(),
      adresse: this.normalizeText(data.adresse),
      medicalSpecialty: data.medicalSpecialty?.trim()
        ? this.normalizeText(data.medicalSpecialty)
        : undefined,
      medicalExpertises: data.medicalExpertises
        ?.map((item) => this.normalizeText(item))
        .filter(Boolean),
      medicalDocumentNames: data.medicalDocumentNames
        ?.map((item) => item.trim())
        .filter(Boolean),
    };

    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/register`, payload)
      .pipe(map(unwrapApiResponse));
  }

  sendOtp(data: SendOtpRequestDto): Observable<SendOtpResponseDto> {
    return this.http
      .post<ApiResponse<SendOtpResponseDto>>(`${this.apiUrl}/otp/send`, data)
      .pipe(map(unwrapApiResponse));
  }

  verifyOtp(data: VerifyOtpRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/otp/verify`, data)
      .pipe(map(unwrapApiResponse));
  }

  refresh(data: RefreshTokenRequestDto = {}): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/refresh`, data, {
        withCredentials: true,
      })
      .pipe(map(unwrapApiResponse));
  }

  googleLogin(data: GoogleLoginRequestDto): Observable<AuthResponseDto> {
    return this.http
      .post<ApiResponse<AuthResponseDto>>(`${this.apiUrl}/google/login`, data)
      .pipe(map(unwrapApiResponse));
  }

  me(): Observable<UserProfileDto> {
    return this.http
      .get<ApiResponse<UserProfileDto>>(`${this.apiUrl}/me`)
      .pipe(map(unwrapApiResponse));
  }

  myUserProfile(): Observable<UserProfileDto> {
    return this.http
      .get<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me`)
      .pipe(map(unwrapApiResponse));
  }

  myUserHistory(limit = 8): Observable<UserHistoryItemView[]> {
    return this.http
      .get<ApiResponse<UserHistoryItemView[]>>(`${this.usersApiUrl}/me/history`, {
        params: { limit },
      })
      .pipe(map(unwrapApiResponse));
  }

  getMyMedicalProfile(): Observable<MedicalProfileView> {
    return this.http
      .get<ApiResponse<MedicalProfileView>>(`${this.usersApiUrl}/me/medical-profile`)
      .pipe(map(unwrapApiResponse));
  }

  updateMyMedicalProfile(data: {
    bloodGroup?: string | null;
    rhesus?: string | null;
    weightKg?: number | null;
    heightCm?: number | null;
    referenceDoctorName?: string | null;
    profession?: string | null;
    allergies?: string[];
    conditions?: string[];
  }): Observable<MedicalProfileView> {
    return this.http
      .put<ApiResponse<MedicalProfileView>>(`${this.usersApiUrl}/me/medical-profile`, data)
      .pipe(map(unwrapApiResponse));
  }

  createMyMedicalTreatment(data: {
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    notes?: string | null;
  }): Observable<MedicalProfileView> {
    return this.http
      .post<ApiResponse<MedicalProfileView>>(`${this.usersApiUrl}/me/medical-profile/treatments`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateMyMedicalTreatment(
    treatmentId: string,
    data: {
      name: string;
      dosage?: string | null;
      frequency?: string | null;
      startedAt?: string | null;
      endedAt?: string | null;
      notes?: string | null;
    },
  ): Observable<MedicalProfileView> {
    return this.http
      .patch<ApiResponse<MedicalProfileView>>(`${this.usersApiUrl}/me/medical-profile/treatments/${treatmentId}`, data)
      .pipe(map(unwrapApiResponse));
  }

  deleteMyMedicalTreatment(treatmentId: string): Observable<MedicalProfileView> {
    return this.http
      .delete<ApiResponse<MedicalProfileView>>(`${this.usersApiUrl}/me/medical-profile/treatments/${treatmentId}`)
      .pipe(map(unwrapApiResponse));
  }

  updateMyProfile(data: {
    name?: string;
    email?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    avatarUrl?: string | null;
  }): Observable<UserProfileDto> {
    return this.http
      .patch<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateMyAvatar(avatarUrl: string | null): Observable<UserProfileDto> {
    return this.http
      .post<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/avatar`, { avatarUrl })
      .pipe(map(unwrapApiResponse));
  }

  uploadMyAvatar(file: File): Observable<UserProfileDto> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http
      .post<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/avatar/upload`, formData)
      .pipe(map(unwrapApiResponse));
  }

  uploadMyProfessionalCredential(file: File): Observable<UserProfileDto> {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', file.name);
    return this.http
      .post<ApiResponse<unknown>>(`${this.usersApiUrl}/me/professional-credentials/upload`, formData)
      .pipe(
        switchMap(() => this.myUserProfile()),
      );
  }

  deleteMyProfessionalCredential(credentialId: string): Observable<UserProfileDto> {
    return this.http
      .delete<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/professional-credentials/${credentialId}`)
      .pipe(map(unwrapApiResponse));
  }

  updateMyProfessionalAbout(about: string): Observable<UserProfileDto> {
    return this.http
      .patch<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/professional-about`, { about })
      .pipe(map(unwrapApiResponse));
  }

  addMyProfessionalExpertise(name: string): Observable<UserProfileDto> {
    return this.http
      .post<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/professional-expertises`, { name })
      .pipe(map(unwrapApiResponse));
  }

  removeMyProfessionalExpertise(name: string): Observable<UserProfileDto> {
    return this.http
      .delete<ApiResponse<UserProfileDto>>(`${this.usersApiUrl}/me/professional-expertises`, {
        body: { name },
      })
      .pipe(map(unwrapApiResponse));
  }

  deleteMyAccount(): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.usersApiUrl}/me`)
      .pipe(map(() => undefined));
  }

  changeMyPassword(data: {
    currentPassword?: string;
    newPassword: string;
  }): Observable<void> {
    return this.http
      .patch<ApiResponse<null>>(`${this.usersApiUrl}/me/password`, data)
      .pipe(map(() => undefined));
  }

  listSavedPaymentMethods(): Observable<SavedPaymentMethodView[]> {
    return this.http
      .get<ApiResponse<SavedPaymentMethodView[]>>(`${this.paymentsApiUrl}/methods/saved`)
      .pipe(map(unwrapApiResponse));
  }

  createSavedPaymentMethod(data: {
    type: SavedPaymentMethodType;
    label?: string;
    cardNumber?: string;
    holderName?: string;
    expiryMonth?: number;
    expiryYear?: number;
    phoneNumber?: string;
  }): Observable<SavedPaymentMethodView> {
    return this.http
      .post<ApiResponse<SavedPaymentMethodView>>(`${this.paymentsApiUrl}/methods/saved`, data)
      .pipe(map(unwrapApiResponse));
  }

  updateSavedPaymentMethod(
    methodId: string,
    data: {
      label?: string;
      cardNumber?: string;
      holderName?: string;
      expiryMonth?: number;
      expiryYear?: number;
      phoneNumber?: string;
    },
  ): Observable<SavedPaymentMethodView> {
    return this.http
      .patch<ApiResponse<SavedPaymentMethodView>>(`${this.paymentsApiUrl}/methods/saved/${methodId}`, data)
      .pipe(map(unwrapApiResponse));
  }

  deleteSavedPaymentMethod(methodId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.paymentsApiUrl}/methods/saved/${methodId}`)
      .pipe(map(() => undefined));
  }

  listPaymentHistory(): Observable<PaymentHistoryView[]> {
    return this.http
      .get<ApiResponse<PaymentHistoryView[]>>(`${this.paymentsApiUrl}/history`)
      .pipe(map(unwrapApiResponse));
  }

  listWithdrawalRequests(): Observable<WithdrawalRequestView[]> {
    return this.http
      .get<ApiResponse<WithdrawalRequestView[]>>(`${this.paymentsApiUrl}/withdrawals`)
      .pipe(map(unwrapApiResponse));
  }

  getPayment(paymentId: string): Observable<PaymentHistoryView> {
    return this.http
      .get<ApiResponse<PaymentHistoryView>>(`${this.paymentsApiUrl}/${paymentId}`)
      .pipe(map(unwrapApiResponse));
  }

  releasePaymentEscrow(paymentId: string): Observable<PaymentHistoryView> {
    return this.http
      .patch<ApiResponse<PaymentHistoryView>>(`${this.paymentsApiUrl}/${paymentId}/escrow/release`, {})
      .pipe(map(unwrapApiResponse));
  }

  disputePaymentEscrow(paymentId: string, reason?: string): Observable<PaymentHistoryView> {
    return this.http
      .patch<ApiResponse<PaymentHistoryView>>(`${this.paymentsApiUrl}/${paymentId}/escrow/dispute`, {
        reason,
      })
      .pipe(map(unwrapApiResponse));
  }

  getPaymentEscrowStatus(paymentId: string): Observable<PaymentEscrowStatusView> {
    return this.http
      .get<ApiResponse<PaymentEscrowStatusView>>(`${this.paymentsApiUrl}/${paymentId}/escrow/status`)
      .pipe(map(unwrapApiResponse));
  }

  logout(): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.apiUrl}/logout`, {})
      .pipe(map(() => undefined));
  }

  private normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}
