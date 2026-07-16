import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../http/api-response.models';
import { unwrapApiResponse } from '../http/api-response.utils';

export type FavoriteServiceTravelMode =
  | 'PRESTATAIRE_SE_DEPLACE'
  | 'CLIENT_SE_DEPLACE'
  | 'TRANSPORT_COLIS';

export type FavoriteProfessionalVehicleType =
  | 'MOTO_SCOOTER'
  | 'VOITURE'
  | 'CAMIONNETTE';

export interface FavoriteItem {
  id: string;
  professionalId: string;
  createdAt: string;
  name: string;
  subtitle: string;
  location: string;
  vehicleType?: FavoriteProfessionalVehicleType;
  avatarUrl: string | null;
  rating: number;
  totalReviews: number;
  isOnline: boolean;
  presenceStatus: string;
  lastSeenAt: string | null;
  isAvailableToday: boolean;
  isNew: boolean;
  portfolioImages: {
    id: string;
    title: string;
    url: string;
  }[];
  service: {
    id: string;
    name: string;
    price: number;
    priceType: string;
    travelMode?: FavoriteServiceTravelMode;
    categoryId: string;
    categoryName: string;
    subCategoryId?: string | null;
    subCategoryName?: string | null;
    subCategoryNames?: string[];
  } | null;
}

export interface FavoriteStatus {
  professionalId: string;
  isFavorite: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/favorites`;
  private readonly favoritesSignal = signal<FavoriteItem[]>([]);

  readonly favorites = this.favoritesSignal.asReadonly();

  list(): Observable<FavoriteItem[]> {
    return this.http.get<ApiResponse<FavoriteItem[]>>(this.apiUrl).pipe(
      map(unwrapApiResponse),
      tap((favorites) => this.favoritesSignal.set(favorites)),
    );
  }

  status(professionalId: string): Observable<FavoriteStatus> {
    return this.http
      .get<ApiResponse<FavoriteStatus>>(
        `${this.apiUrl}/professionals/${professionalId}/status`,
      )
      .pipe(map(unwrapApiResponse));
  }

  add(professionalId: string): Observable<FavoriteItem> {
    return this.http
      .post<ApiResponse<FavoriteItem>>(
        `${this.apiUrl}/professionals/${professionalId}`,
        {},
      )
      .pipe(
        map(unwrapApiResponse),
        tap((favorite) => {
          this.favoritesSignal.update((favorites) => [
            favorite,
            ...favorites.filter((item) => item.professionalId !== professionalId),
          ]);
        }),
      );
  }

  remove(professionalId: string): Observable<FavoriteStatus> {
    return this.http
      .delete<ApiResponse<FavoriteStatus>>(
        `${this.apiUrl}/professionals/${professionalId}`,
      )
      .pipe(
        map(unwrapApiResponse),
        tap(() => {
          this.favoritesSignal.update((favorites) =>
            favorites.filter((item) => item.professionalId !== professionalId),
          );
        }),
      );
  }
}
