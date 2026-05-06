import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface FavoriteItem {
  id: string;
  name: string;
  subtitle: string;
  location: string;
  imageUrl: string | null;
  route: string;
  source: 'services' | 'medicine';
}

const FAVORITES_KEY = 'jokkoFavorites';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly favoritesSignal = signal<FavoriteItem[]>(this.readFavorites());

  readonly favorites = this.favoritesSignal.asReadonly();

  isFavorite(id: string): boolean {
    return this.favoritesSignal().some((favorite) => favorite.id === id);
  }

  toggle(item: FavoriteItem): boolean {
    const exists = this.isFavorite(item.id);
    const nextFavorites = exists
      ? this.favoritesSignal().filter((favorite) => favorite.id !== item.id)
      : [item, ...this.favoritesSignal()];

    this.favoritesSignal.set(nextFavorites);
    this.persist(nextFavorites);
    return !exists;
  }

  remove(id: string): void {
    const nextFavorites = this.favoritesSignal().filter((favorite) => favorite.id !== id);
    this.favoritesSignal.set(nextFavorites);
    this.persist(nextFavorites);
  }

  private readFavorites(): FavoriteItem[] {
    if (!this.canUseStorage()) return [];

    const rawFavorites = localStorage.getItem(FAVORITES_KEY);
    if (!rawFavorites) return [];

    try {
      const parsed = JSON.parse(rawFavorites) as FavoriteItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      localStorage.removeItem(FAVORITES_KEY);
      return [];
    }
  }

  private persist(favorites: FavoriteItem[]): void {
    if (!this.canUseStorage()) return;
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
