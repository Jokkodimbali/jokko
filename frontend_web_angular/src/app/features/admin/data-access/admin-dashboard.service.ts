import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

export interface AdminKpi {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  caption: string;
  tone: 'neutral' | 'success' | 'danger' | string;
}

export interface AdminPlatformMetric {
  key: 'web' | 'ios' | 'android' | string;
  label: string;
  value: number;
  share: number;
}

export interface AdminSeriesPoint {
  label: string;
  gross?: number;
  commission?: number;
  web?: number;
  ios?: number;
  android?: number;
}

export interface AdminCategoryMetric {
  label: string;
  value: number;
  share: number;
}

export interface AdminActivityItem {
  title: string;
  description: string;
  timestamp: string | Date;
}

export interface AdminKycProfile {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  urlPieceIdentiteRecto: string | null;
  urlPieceIdentiteVerso: string | null;
  statutKyc: 'EN_ATTENTE' | 'VERIFIE' | 'REJETE' | 'NON_SOUMIS' | string;
  raisonRejetKyc: string | null;
  ville: string | null;
  creeLe: string | Date;
  utilisateur: {
    id: string;
    nom: string;
    numeroTelephone: string;
    urlAvatar: string | null;
    estActif: boolean;
  };
}

export interface AdminDashboard {
  users: { active: number; total: number };
  kyc: { pending: number };
  reservations: {
    pending: number;
    confirmed: number;
    inEscrow: number;
    inProgress: number;
    active: number;
    completed?: number;
  };
  disputes: { open: number; inReview: number; resolved: number; rejected: number };
  revenue: {
    gross: number;
    commission: number;
    monthlyGross?: number;
    monthlyCommission?: number;
  };
  overview: {
    status: string;
    kpis: AdminKpi[];
    platforms: AdminPlatformMetric[];
    revenueSeries: AdminSeriesPoint[];
    trafficSeries: AdminSeriesPoint[];
    categoryDistribution: AdminCategoryMetric[];
    recentActivity: AdminActivityItem[];
  };
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/dashboard`;
  private readonly kycUrl = `${environment.apiUrl}/admin/kyc`;

  getDashboard(): Observable<AdminDashboard> {
    return this.http
      .get<ApiResponse<AdminDashboard>>(this.apiUrl)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  listPendingKyc(): Observable<AdminKycProfile[]> {
    return this.http
      .get<ApiResponse<AdminKycProfile[]>>(this.kycUrl, {
        params: { status: 'EN_ATTENTE', limit: 100, offset: 0 },
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  approveKyc(profileId: string): Observable<AdminKycProfile> {
    return this.http
      .patch<ApiResponse<AdminKycProfile>>(`${this.kycUrl}/${profileId}/approve`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  rejectKyc(profileId: string, reason: string): Observable<AdminKycProfile> {
    return this.http
      .patch<ApiResponse<AdminKycProfile>>(`${this.kycUrl}/${profileId}/reject`, { reason })
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
