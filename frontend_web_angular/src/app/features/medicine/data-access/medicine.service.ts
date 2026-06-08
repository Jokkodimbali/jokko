import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  BackendProfessional,
  BackendProfessionalAvailability,
  BackendProfessionalPresence,
  PaginationMeta,
} from '../../services/domain/models/services.models';
import { DoctorProfile } from '../domain/models/medicine.models';

@Injectable({
  providedIn: 'root',
})
export class MedicineService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listDoctors(page: number = 1, limit: number = 12): Observable<{ doctors: DoctorProfile[]; meta?: PaginationMeta }> {
    return this.http
      .get<ApiResponse<BackendProfessional[]>>(`${this.apiUrl}/search/professionals`, {
        params: {
          role: 'MEDECIN',
          page: page.toString(),
          limit: limit.toString(),
        },
      })
      .pipe(
        map((response) => ({
          doctors: unwrapApiResponse(response).map((professional) =>
            this.mapDoctor(professional),
          ),
          meta: response.meta?.['pagination'] as PaginationMeta | undefined,
        })),
      );
  }

  private getProfessionalAvailabilities(profileId: string): Observable<BackendProfessionalAvailability[]> {
    return this.http
      .get<ApiResponse<BackendProfessionalAvailability[]>>(
        `${this.apiUrl}/professionals/${profileId}/availabilities`,
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

  private mapDoctor(
    professional: BackendProfessional,
    availabilities: BackendProfessionalAvailability[] = [],
    presence: BackendProfessionalPresence | null = null,
  ): DoctorProfile {
    const primaryService = professional.services[0];
    const medicalSpecialty = this.extractMedicalSpecialty(professional.bio);
    const nextAvailability = this.buildNextAvailabilityLabels(availabilities);

    return {
      id: professional.id,
      name: professional.companyName || professional.name,
      specialty:
        primaryService?.name ||
        primaryService?.categoryName ||
        medicalSpecialty ||
        'Specialite non renseignee',
      rating: professional.rating || 0,
      reviewCount: professional.totalReviews || 0,
      location: (professional.city || 'Localisation non renseignee').toUpperCase(),
      latitude: professional.latitude,
      longitude: professional.longitude,
      imageUrl: this.absoluteAssetUrl(professional.avatarUrl) || '',
      isOnline: Boolean(presence?.isOnline),
      nextAvailability,
      availability: [
        {
          period: 'Prochaines dispos',
          days: nextAvailability,
        },
      ],
    };
  }

  private buildNextAvailabilityLabels(availabilities: BackendProfessionalAvailability[]): string[] {
    const activeWeekdays = new Set(
      availabilities
        .filter((availability) => availability.estActive)
        .map((availability) => availability.jourSemaine),
    );

    if (activeWeekdays.size === 0) {
      return [];
    }

    const formatter = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
    });
    const labels: string[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 21 && labels.length < 4; offset += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + offset);

      if (!activeWeekdays.has(date.getDay())) {
        continue;
      }

      labels.push(
        formatter
          .format(date)
          .replace('.', '')
          .replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
      );
    }

    return labels;
  }

  private extractMedicalSpecialty(bio: string | null): string | null {
    if (!bio) {
      return null;
    }

    const match = bio.match(/Specialite\s*:\s*([^\n]+)/i);
    return match?.[1]?.trim() || null;
  }

  private absoluteAssetUrl(url: string | null | undefined): string | null {
    const value = url?.trim();
    if (!value) {
      return null;
    }

    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
      return value;
    }

    if (value.startsWith('/')) {
      return `${new URL(this.apiUrl).origin}${value}`;
    }

    return value;
  }
}
