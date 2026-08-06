import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { AdminUserHistory, AdminUserProfile, AdminUserQuery, AdminUserRow } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = `${environment.apiUrl}/admin/users`;

  list(query: AdminUserQuery = {}): Observable<AdminUserRow[]> {
    return this.http
      .get<ApiResponse<AdminUserRow[]>>(this.usersUrl, { params: this.toParams(query) })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  get(userId: string): Observable<AdminUserProfile> {
    return this.http
      .get<ApiResponse<AdminUserProfile>>(`${this.usersUrl}/${userId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  history(userId: string, limit = 20): Observable<AdminUserHistory> {
    return this.http
      .get<
        ApiResponse<AdminUserHistory>
      >(`${this.usersUrl}/${userId}/history`, { params: { limit } })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  setActive(userId: string, active: boolean): Observable<AdminUserProfile> {
    return this.http
      .patch<
        ApiResponse<AdminUserProfile>
      >(`${this.usersUrl}/${userId}/${active ? 'unblock' : 'block'}`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private toParams(query: AdminUserQuery): Record<string, string> {
    return Object.entries(query).reduce<Record<string, string>>((params, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') params[key] = String(value);
      return params;
    }, {});
  }
}
