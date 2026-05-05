import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BackendProfessional,
  Category,
  Professional,
  ServiceSection,
  PaginationMeta,
} from '../domain/models/services.models';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

@Injectable({
  providedIn: 'root',
})
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getCategories(
    page: number = 1,
    limit: number = 10,
  ): Observable<{ items: Category[]; meta?: PaginationMeta }> {
    return this.http
      .get<ApiResponse<Category[]>>(`${this.apiUrl}/categories`, {
        params: { page: page.toString(), limit: limit.toString() },
      })
      .pipe(
        map((response) => ({
          items: unwrapApiResponse(response),
          meta: response.meta?.['pagination'] as PaginationMeta | undefined,
        })),
      );
  }

  getProfessionalsByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 3,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    return this.http
      .get<ApiResponse<BackendProfessional[]>>(`${this.apiUrl}/professionals`, {
        params: { categoryId, page: page.toString(), limit: limit.toString() },
      })
      .pipe(
        map((response) => ({
          providers: unwrapApiResponse(response).map((p) => this.mapProfessional(p)),
          meta: response.meta?.['pagination'] as PaginationMeta | undefined,
        })),
      );
  }

  getServiceHomeData(
    page: number = 1,
    limit: number = 6,
  ): Observable<{ sections: ServiceSection[]; meta?: PaginationMeta }> {
    return this.getCategories(page, limit).pipe(
      switchMap((result) => {
        const categories = result.items;
        if (!categories || categories.length === 0) return of({ sections: [], meta: result.meta });

        const categoryRequests = categories.map((category) =>
          this.getProfessionalsByCategory(category.id).pipe(
            map(
              (pResult) =>
                ({
                  id: category.id,
                  title: category.nom,
                  countLabel: `${pResult.meta?.total || pResult.providers.length} Professionnels`,
                  providers: pResult.providers,
                  pagination: pResult.meta,
                }) as ServiceSection,
            ),
            catchError(() => of(null)),
          ),
        );

        return forkJoin(categoryRequests).pipe(
          map((sections) => ({
            sections: sections.filter((s): s is ServiceSection => s !== null),
            meta: result.meta,
          })),
        );
      }),
    );
  }

  private mapProfessional(data: BackendProfessional): Professional {
    const primaryService = data.services[0];

    return {
      id: data.id,
      nom: data.companyName || data.name,
      speciality: primaryService?.categoryName || primaryService?.name || 'Service',
      location: data.city || 'Dakar',
      status: data.totalReviews > 0 ? `${data.rating}/5 (${data.totalReviews} avis)` : 'Nouveau',
      avatar: data.avatarUrl || undefined,
      photos: [],
    };
  }
}
