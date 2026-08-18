import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, of, catchError, shareReplay, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { publicAssetUrl } from '../../../shared/utils/public-asset-url';
import {
  BackendProfessionalAvailability,
  BackendProfessional,
  BackendProfessionalDetailService,
  BackendProfessionalPortfolioItem,
  BackendProfessionalPresence,
  BackendProfessionalProfile,
  BackendProfessionalReview,
  Category,
  CategoryStructure,
  Professional,
  ProviderProfileDetail,
  ServiceSection,
  PaginationMeta,
  ServiceTravelMode,
} from '../domain/models/services.models';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

export interface ProfessionalSearchLocation {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly cacheTtlMs = 45_000;
  private readonly cache = new Map<string, { expiresAt: number; value$: Observable<unknown> }>();

  getCategories(
    page: number = 1,
    limit: number = 10,
  ): Observable<{ items: Category[]; meta?: PaginationMeta }> {
    return this.cacheFor(`categories:${page}:${limit}`, () =>
      this.http
        .get<ApiResponse<Category[]>>(`${this.apiUrl}/categories`, {
          params: { page: page.toString(), limit: limit.toString() },
        })
        .pipe(
          map((response) => ({
            items: unwrapApiResponse(response),
            meta: response.meta?.['pagination'] as PaginationMeta | undefined,
          })),
        ),
    );
  }

  getCategoryStructure(): Observable<CategoryStructure[]> {
    return this.cacheFor('categories:structure', () =>
      this.http
        .get<ApiResponse<CategoryStructure[]>>(`${this.apiUrl}/categories/structure`)
        .pipe(map((response) => unwrapApiResponse(response))),
    );
  }

  getAvailableCities(): Observable<string[]> {
    return this.cacheFor('professionals:available-cities', () =>
      this.http
        .get<ApiResponse<string[]>>(`${this.apiUrl}/search/professionals/cities`)
        .pipe(map((response) => unwrapApiResponse(response))),
    );
  }

  getProfessionalsByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 3,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    return this.cacheFor(`professionals:category:${categoryId}:${page}:${limit}`, () =>
      this.http
        .get<ApiResponse<BackendProfessional[]>>(`${this.apiUrl}/professionals`, {
          params: { categoryId, page: page.toString(), limit: limit.toString() },
        })
        .pipe(
          map((response) => ({
            providers: unwrapApiResponse(response).map((professional) =>
              this.mapProfessional(professional),
            ),
            meta: response.meta?.['pagination'] as PaginationMeta | undefined,
          })),
        ),
    );
  }

  searchProfessionals(
    query: string,
    page: number = 1,
    limit: number = 6,
    city?: string,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    return this.fetchProfessionals({ query, page, limit, city });
  }

  searchUnifiedProfessionals(
    query: string = '',
    page: number = 1,
    limit: number = 24,
    city?: string,
    categoryId?: string,
    subCategoryId?: string,
    travelMode?: ServiceTravelMode,
    location?: ProfessionalSearchLocation,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    const searchBothRoles = (searchLocation?: ProfessionalSearchLocation) =>
      forkJoin([
        this.fetchProfessionals({
          query,
          page,
          limit,
          city,
          categoryId,
          subCategoryId,
          travelMode,
          location: searchLocation,
          role: 'PRESTATAIRE',
        }).pipe(catchError(() => of({ providers: [], meta: undefined }))),
        this.fetchProfessionals({
          query,
          page,
          limit,
          city,
          categoryId,
          subCategoryId,
          travelMode,
          location: searchLocation,
          role: 'MEDECIN',
        }).pipe(catchError(() => of({ providers: [], meta: undefined }))),
      ]);

    return searchBothRoles(location).pipe(
      map(([providersResult, doctorsResult]) => {
        const providers = this.mergeProfessionals(
          providersResult.providers,
          doctorsResult.providers.map((provider) => ({
            ...provider,
            profileType: 'MEDECIN' as const,
          })),
        );
        if (location) {
          providers.sort(
            (current, next) =>
              (current.distanceKm ?? Number.POSITIVE_INFINITY) -
              (next.distanceKm ?? Number.POSITIVE_INFINITY),
          );
        }
        const total =
          (providersResult.meta?.total ?? providersResult.providers.length) +
          (doctorsResult.meta?.total ?? doctorsResult.providers.length);
        const totalPages = Math.max(
          providersResult.meta?.totalPages ?? 1,
          doctorsResult.meta?.totalPages ?? 1,
        );

        return {
          providers,
          meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: Boolean(providersResult.meta?.hasNext || doctorsResult.meta?.hasNext),
            hasPrevious: page > 1,
          },
        };
      }),
    );
  }

  searchProfessionalsByRole(
    role: 'PRESTATAIRE' | 'MEDECIN',
    query: string = '',
    page: number = 1,
    limit: number = 24,
    city?: string,
    categoryId?: string,
    subCategoryId?: string,
    travelMode?: ServiceTravelMode,
    location?: ProfessionalSearchLocation,
  ): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
    return this.fetchProfessionals({
      query,
      page,
      limit,
      city,
      categoryId,
      subCategoryId,
      travelMode,
      location,
      role,
    });
  }

  private fetchProfessionals({
    query,
    page,
    limit,
    city,
    categoryId,
    subCategoryId,
    travelMode,
    location,
    role,
  }: {
    query: string;
    page: number;
    limit: number;
    city?: string;
    categoryId?: string;
    subCategoryId?: string;
    travelMode?: ServiceTravelMode;
    location?: ProfessionalSearchLocation;
    role?: 'PRESTATAIRE' | 'MEDECIN';
  }): Observable<{ providers: Professional[]; meta?: PaginationMeta }> {
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

    if (categoryId?.trim()) {
      params['categoryId'] = categoryId.trim();
    }

    if (subCategoryId?.trim()) {
      params['subCategoryId'] = subCategoryId.trim();
    }

    if (travelMode?.trim()) {
      params['travelMode'] = travelMode.trim();
    }

    if (location) {
      params['latitude'] = location.latitude.toString();
      params['longitude'] = location.longitude.toString();
      params['radiusKm'] = (location.radiusKm ?? 25).toString();
    }

    if (role) {
      params['role'] = role;
    }

    const cacheKey = `professionals:search:${JSON.stringify(params)}`;
    return this.cacheFor(cacheKey, () =>
      this.http
        .get<ApiResponse<BackendProfessional[]>>(`${this.apiUrl}/search/professionals`, {
          params,
        })
        .pipe(
          map((response) => ({
            providers: unwrapApiResponse(response).map((professional) =>
              this.mapProfessional(professional, undefined, null, role),
            ),
            meta: response.meta?.['pagination'] as PaginationMeta | undefined,
          })),
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
    return this.cacheFor(
      `provider-profile-detail:${profileId}`,
      () =>
        forkJoin({
          profile: this.getProfessionalProfile(profileId),
          services: this.getProfessionalServices(profileId),
          portfolio: this.getProfessionalPortfolio(profileId),
          availabilities: this.getProfessionalAvailabilities(profileId),
          reviews: this.getProfessionalReviews(profileId),
          presence: this.getProfessionalPresence(profileId),
        }),
      20_000,
    );
  }

  clearCache(): void {
    this.cache.clear();
  }

  private getProfessionalProfile(profileId: string): Observable<BackendProfessionalProfile> {
    return this.http
      .get<ApiResponse<BackendProfessionalProfile>>(`${this.apiUrl}/professionals/${profileId}`)
      .pipe(
        map((response) => {
          const profile = unwrapApiResponse(response);
          return {
            ...profile,
            utilisateur: {
              ...profile.utilisateur,
              urlAvatar: this.absoluteAssetUrl(profile.utilisateur.urlAvatar),
            },
          };
        }),
      );
  }

  private getProfessionalServices(
    profileId: string,
  ): Observable<BackendProfessionalDetailService[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalDetailService[]>
      >(`${this.apiUrl}/professionals/${profileId}/services`)
      .pipe(
        map((response) =>
          unwrapApiResponse(response).map((service) => ({
            ...service,
            urlImage: this.absoluteAssetUrl(service.urlImage) ?? service.urlImage,
          })),
        ),
      );
  }

  private getProfessionalPortfolio(
    profileId: string,
  ): Observable<BackendProfessionalPortfolioItem[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalPortfolioItem[]>
      >(`${this.apiUrl}/professionals/${profileId}/portfolio`)
      .pipe(
        map((response) =>
          unwrapApiResponse(response).map((item) => ({
            ...item,
            urlImage: this.absoluteAssetUrl(item.urlImage) ?? item.urlImage,
          })),
        ),
      );
  }

  private getProfessionalAvailabilities(
    profileId: string,
  ): Observable<BackendProfessionalAvailability[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalAvailability[]>
      >(`${this.apiUrl}/professionals/${profileId}/availabilities`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalReviews(profileId: string): Observable<BackendProfessionalReview[]> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalReview[]>
      >(`${this.apiUrl}/professionals/${profileId}/reviews`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private getProfessionalPresence(profileId: string): Observable<BackendProfessionalPresence> {
    return this.http
      .get<
        ApiResponse<BackendProfessionalPresence>
      >(`${this.apiUrl}/professionals/${profileId}/presence`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private mapProfessional(
    data: BackendProfessional,
    photos: string[] = this.mapPortfolioPhotos(data),
    presence: BackendProfessionalPresence | null = null,
    profileType?: 'PRESTATAIRE' | 'MEDECIN',
  ): Professional {
    const primaryService = data.services[0];
    const primarySpecialty = data.specialties?.[0];
    const subCategoryNames = this.uniqueLabels([
      ...(data.specialties ?? []).map((specialty) => specialty.subCategoryName || specialty.name),
      ...(data.services ?? []).map((service) => service.subCategoryName),
    ]);
    const isOnline = Boolean(presence?.isOnline);
    const servicePrices = data.services
      .map((service) => Number(service.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    return {
      id: data.id,
      userId: data.userId,
      profileType,
      serviceId: primaryService?.id,
      servicePriceType: primaryService?.priceType,
      serviceTravelMode: primaryService?.travelMode,
      servicePriceMin: servicePrices.length ? Math.min(...servicePrices) : undefined,
      servicePriceMax: servicePrices.length ? Math.max(...servicePrices) : undefined,
      nom: data.companyName || data.name,
      categoryName:
        primaryService?.categoryName ||
        primarySpecialty?.categoryName ||
        (profileType === 'MEDECIN' ? 'MEDECINE' : 'SERVICE'),
      subCategoryName:
        subCategoryNames[0] ||
        primarySpecialty?.subCategoryName ||
        primaryService?.subCategoryName ||
        null,
      subCategoryNames,
      professionName:
        primaryService?.name ||
        primarySpecialty?.name ||
        primaryService?.categoryName ||
        primarySpecialty?.categoryName ||
        'Profession non renseignee',
      speciality:
        primaryService?.name ||
        primaryService?.categoryName ||
        primarySpecialty?.name ||
        primarySpecialty?.categoryName ||
        'Service',
      location: this.formatLocation(data.city, data.distanceKm),
      latitude: data.latitude,
      longitude: data.longitude,
      distanceKm: data.distanceKm,
      status: data.totalReviews > 0 ? `${data.rating}/5 (${data.totalReviews} avis)` : 'Nouveau',
      rating: data.rating,
      totalReviews: data.totalReviews,
      vehicleType: data.typeVehicule,
      isOnline,
      onlineLabel: this.formatPresenceLabel(presence),
      avatar: this.absoluteAssetUrl(data.avatarUrl) || undefined,
      services: data.services.map((service) => ({
        ...service,
        urlImage: this.absoluteAssetUrl(service.urlImage) ?? service.urlImage ?? null,
      })),
      photos,
    };
  }

  private uniqueLabels(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const labels: string[] = [];

    for (const value of values) {
      const label = value?.trim();
      if (!label) {
        continue;
      }

      const key = label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      labels.push(label);
    }

    return labels;
  }

  private mergeProfessionals(...groups: Professional[][]): Professional[] {
    const professionals = new Map<string, Professional>();

    for (const professional of groups.flat()) {
      const existing = professionals.get(professional.id);
      professionals.set(professional.id, {
        ...existing,
        ...professional,
        profileType: professional.profileType ?? existing?.profileType,
      });
    }

    return [...professionals.values()];
  }

  private mapPortfolioPhotos(data: BackendProfessional): string[] {
    return (data.portfolioImages ?? [])
      .map((image) => this.absoluteAssetUrl(image.url))
      .filter((url): url is string => Boolean(url));
  }

  private absoluteAssetUrl(url: string | null | undefined): string | null {
    const value = url?.trim();
    if (!value) {
      return null;
    }

    return publicAssetUrl(value);
  }

  private cacheFor<T>(
    key: string,
    factory: () => Observable<T>,
    ttlMs = this.cacheTtlMs,
  ): Observable<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value$ as Observable<T>;
    }

    const value$ = factory().pipe(
      tap({ error: () => this.cache.delete(key) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache.set(key, { expiresAt: now + ttlMs, value$ });
    return value$;
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
    const cityLabel = this.humanLocationLabel(city);

    if (distanceKm === null) {
      return cityLabel;
    }

    return `${cityLabel} - ${distanceKm.toFixed(1)} KM`;
  }

  private humanLocationLabel(value: string | null): string {
    const label = value?.trim();
    if (!label) {
      return 'Localisation non renseignee';
    }

    if (this.looksLikeCoordinates(label)) {
      return 'Dakar, Senegal';
    }

    return label;
  }

  private looksLikeCoordinates(value: string): boolean {
    return /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value.trim());
  }
}
