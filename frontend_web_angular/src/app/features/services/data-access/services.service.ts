import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BackendProfessionalAvailability,
  BackendProfessional,
  BackendProfessionalDetailService,
  BackendProfessionalPortfolioItem,
  BackendProfessionalPresence,
  BackendProfessionalProfile,
  BackendProfessionalReview,
  Category,
  Professional,
  ProviderProfileDetail,
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
        switchMap((response) =>
          this.attachPortfolioPhotos(unwrapApiResponse(response)).pipe(
            map((providers) => ({
              providers,
              meta: response.meta?.['pagination'] as PaginationMeta | undefined,
            })),
          ),
        ),
      );
  }

  searchProfessionals(
    query: string,
    page: number = 1,
    limit: number = 6,
    city?: string,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    const params: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
    };

    if (query.trim()) {
      params['query'] = query.trim();
    }

    if (city?.trim()) {
      params['city'] = city.trim();
    }

    return this.http
      .get<ApiResponse<BackendProfessional[]>>(`${this.apiUrl}/search/professionals`, {
        params,
      })
      .pipe(
        switchMap((response) =>
          this.attachPortfolioPhotos(unwrapApiResponse(response)).pipe(
            map((providers) => ({
              providers,
              meta: response.meta?.['pagination'] as PaginationMeta | undefined,
            })),
          ),
        ),
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
                  countLabel: `${pResult.meta?.total || pResult.providers.length} professionnels`,
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

  getProviderProfileDetail(profileId: string): Observable<ProviderProfileDetail> {
    return forkJoin({
      profile: this.getProfessionalProfile(profileId),
      services: this.getProfessionalServices(profileId),
      portfolio: this.getProfessionalPortfolio(profileId),
      availabilities: this.getProfessionalAvailabilities(profileId),
      reviews: this.getProfessionalReviews(profileId),
      presence: this.getProfessionalPresence(profileId),
    });
  }

  private getProfessionalProfile(profileId: string): Observable<BackendProfessionalProfile> {
    return this.http
      .get<ApiResponse<BackendProfessionalProfile>>(`${this.apiUrl}/professionals/${profileId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalServices(profileId: string): Observable<BackendProfessionalDetailService[]> {
    return this.http
      .get<ApiResponse<BackendProfessionalDetailService[]>>(
        `${this.apiUrl}/professionals/${profileId}/services`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalPortfolio(profileId: string): Observable<BackendProfessionalPortfolioItem[]> {
    return this.http
      .get<ApiResponse<BackendProfessionalPortfolioItem[]>>(
        `${this.apiUrl}/professionals/${profileId}/portfolio`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalAvailabilities(profileId: string): Observable<BackendProfessionalAvailability[]> {
    return this.http
      .get<ApiResponse<BackendProfessionalAvailability[]>>(
        `${this.apiUrl}/professionals/${profileId}/availabilities`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalReviews(profileId: string): Observable<BackendProfessionalReview[]> {
    return this.http
      .get<ApiResponse<BackendProfessionalReview[]>>(
        `${this.apiUrl}/professionals/${profileId}/reviews`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalPresence(profileId: string): Observable<BackendProfessionalPresence> {
    return this.http
      .get<ApiResponse<BackendProfessionalPresence>>(
        `${this.apiUrl}/professionals/${profileId}/presence`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private attachPortfolioPhotos(data: BackendProfessional[]): Observable<Professional[]> {
    if (data.length === 0) {
      return of([]);
    }

    return forkJoin(
      data.map((professional) =>
        forkJoin({
          portfolio: this.getProfessionalPortfolio(professional.id).pipe(catchError(() => of([]))),
          presence: this.getProfessionalPresence(professional.id).pipe(catchError(() => of(null))),
        }).pipe(
          map(({ portfolio, presence }) =>
            this.mapProfessional(
              professional,
              portfolio.map((item) => item.urlImage).filter(Boolean),
              presence,
            ),
          ),
          catchError(() => of(this.mapProfessional(professional))),
        ),
      ),
    );
  }

  private mapProfessional(
    data: BackendProfessional,
    photos: string[] = [],
    presence: BackendProfessionalPresence | null = null,
  ): Professional {
    const primaryService = data.services[0];
    const isOnline = Boolean(presence?.isOnline);

    return {
      id: data.id,
      serviceId: primaryService?.id,
      servicePriceType: primaryService?.priceType,
      nom: data.companyName || data.name,
      speciality: primaryService?.name || primaryService?.categoryName || 'Service',
      location: this.formatLocation(data.city, data.distanceKm),
      status: data.totalReviews > 0 ? `${data.rating}/5 (${data.totalReviews} avis)` : 'Nouveau',
      rating: data.rating,
      totalReviews: data.totalReviews,
      isOnline,
      onlineLabel: this.formatPresenceLabel(presence),
      avatar: data.avatarUrl || undefined,
      photos,
    };
  }

  private formatPresenceLabel(presence: BackendProfessionalPresence | null): string {
    if (!presence?.isOnline) {
      return 'Hors ligne';
    }

    if (!presence.lastSeenAt) {
      return 'En ligne maintenant';
    }

    const elapsedMs = Date.now() - new Date(presence.lastSeenAt).getTime();
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

    if (elapsedMinutes < 1) {
      return 'En ligne maintenant';
    }

    if (elapsedMinutes < 60) {
      return `En ligne - il y a ${elapsedMinutes} min`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    return `En ligne - il y a ${elapsedHours} h`;
  }

  private formatLocation(city: string | null, distanceKm: number | null): string {
    const cityLabel = city || 'Localisation non renseignee';

    if (distanceKm === null) {
      return cityLabel;
    }

    return `${cityLabel} - ${distanceKm.toFixed(1)} KM`;
  }
}
