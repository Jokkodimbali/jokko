import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  AdminArchivesReport,
  AdminArchivesQuery,
  AdminBulkImportResult,
  AdminCategoryPayload,
  AdminDashboard,
  AdminRegionsReport,
  AdminRevenuePeriod,
  AdminRevenueReport,
  AdminServiceSubCategory,
  AdminServiceStructureCategory,
  AdminServiceStructureReport,
  AdminSubCategoryPayload,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/dashboard`;

  getDashboard(): Observable<AdminDashboard> {
    return this.http
      .get<ApiResponse<AdminDashboard>>(this.apiUrl)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getArchives(query: AdminArchivesQuery = {}): Observable<AdminArchivesReport> {
    return this.http
      .get<ApiResponse<AdminArchivesReport>>(`${environment.apiUrl}/admin/archives`, {
        params: Object.entries(query).reduce<Record<string, string>>((params, [key, value]) => {
          if (value !== undefined && value !== null && value !== '') params[key] = String(value);
          return params;
        }, {}),
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getRevenue(period: AdminRevenuePeriod = '12m'): Observable<AdminRevenueReport> {
    return this.http
      .get<ApiResponse<AdminRevenueReport>>(`${environment.apiUrl}/admin/revenue`, {
        params: { period },
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getRegions(): Observable<AdminRegionsReport> {
    return this.http
      .get<ApiResponse<AdminRegionsReport>>(`${environment.apiUrl}/admin/regions`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getServiceStructure(): Observable<AdminServiceStructureReport> {
    return this.http
      .get<ApiResponse<AdminServiceStructureReport>>(`${environment.apiUrl}/admin/service-structure`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  createCategory(payload: AdminCategoryPayload): Observable<AdminServiceStructureCategory> {
    return this.http
      .post<ApiResponse<AdminServiceStructureCategory>>(`${environment.apiUrl}/admin/categories`, payload)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  bulkCreateCategories(payload: AdminCategoryPayload[]): Observable<AdminBulkImportResult<AdminServiceStructureCategory>> {
    return this.http
      .post<ApiResponse<AdminBulkImportResult<AdminServiceStructureCategory>>>(
        `${environment.apiUrl}/admin/service-structure/categories/bulk`,
        { categories: payload },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  updateCategory(categoryId: string, payload: AdminCategoryPayload): Observable<AdminServiceStructureCategory> {
    return this.http
      .patch<ApiResponse<AdminServiceStructureCategory>>(`${environment.apiUrl}/admin/categories/${categoryId}`, payload)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  disableCategory(categoryId: string): Observable<AdminServiceStructureCategory> {
    return this.http
      .patch<ApiResponse<AdminServiceStructureCategory>>(`${environment.apiUrl}/admin/categories/${categoryId}/disable`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  activateCategory(categoryId: string): Observable<AdminServiceStructureCategory> {
    return this.http
      .patch<ApiResponse<AdminServiceStructureCategory>>(`${environment.apiUrl}/admin/categories/${categoryId}/activate`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  deleteEmptyCategory(categoryId: string): Observable<{ id: string }> {
    return this.http
      .delete<ApiResponse<{ id: string }>>(`${environment.apiUrl}/admin/service-structure/categories/${categoryId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  createSubCategory(payload: AdminSubCategoryPayload): Observable<AdminServiceSubCategory> {
    return this.http
      .post<ApiResponse<AdminServiceSubCategory>>(
        `${environment.apiUrl}/admin/service-structure/subcategories`,
        payload,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  bulkCreateSubCategories(payload: AdminSubCategoryPayload[]): Observable<AdminBulkImportResult<AdminServiceSubCategory>> {
    return this.http
      .post<ApiResponse<AdminBulkImportResult<AdminServiceSubCategory>>>(
        `${environment.apiUrl}/admin/service-structure/subcategories/bulk`,
        { subCategories: payload },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  assignSubCategories(categoryId: string, subCategoryIds: string[]): Observable<AdminServiceStructureCategory> {
    return this.http
      .patch<ApiResponse<AdminServiceStructureCategory>>(
        `${environment.apiUrl}/admin/service-structure/categories/${categoryId}/subcategories`,
        { subCategoryIds },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  deleteUnusedSubCategory(subCategoryId: string): Observable<{ id: string }> {
    return this.http
      .delete<ApiResponse<{ id: string }>>(`${environment.apiUrl}/admin/service-structure/subcategories/${subCategoryId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  uploadServiceCategoryImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http
      .post<ApiResponse<{ imageUrl: string }>>(`${environment.apiUrl}/admin/service-structure/images`, formData)
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
