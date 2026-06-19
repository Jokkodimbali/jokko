import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { publicAssetUrl } from '../../../shared/utils/public-asset-url';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  BackendProfessional,
  BackendProfessionalAvailability,
  BackendProfessionalPresence,
  PaginationMeta,
} from '../../services/domain/models/services.models';
import { DoctorProfile } from '../domain/models/medicine.models';

import { MEDICINE_UI_MESSAGES } from '../domain/medicine-ui.messages';

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
        switchMap((response) => {
          const professionals = unwrapApiResponse(response);
          if (professionals.length === 0) {
            return of({ doctors: [], meta: response.meta?.['pagination'] as PaginationMeta | undefined });
          }

          const doctorRequests = professionals.map((professional) =>
            forkJoin({
              availabilities: this.getProfessionalAvailabilities(professional.id).pipe(catchError(() => of([]))),
              presence: this.getProfessionalPresence(professional.id).pipe(catchError(() => of(null))),
            }).pipe(
              map(({ availabilities, presence }) => this.mapDoctor(professional, availabilities, presence)),
            ),
          );

          return forkJoin(doctorRequests).pipe(
            map((doctors) => ({
              doctors,
              meta: response.meta?.['pagination'] as PaginationMeta | undefined,
            })),
          );
        }),
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
    const modes = Array.from(new Set(
      professional.services
        .map(s => s.travelMode === 'PRESTATAIRE_SE_DEPLACE' ? MEDICINE_UI_MESSAGES.modes.remote : MEDICINE_UI_MESSAGES.modes.office)
        .filter(Boolean) as string[]
    ));

    return {
      id: professional.id,
      name: professional.companyName || professional.name,
      specialty:
        primaryService?.name || // Use service name (sub-category) as specialty
        medicalSpecialty ||
        professional.specialties?.[0]?.name ||
        primaryService?.categoryName ||
        'Médecin',
      rating: professional.rating || 0,
      reviewCount: professional.totalReviews || 0,
      location: (professional.city || 'Localisation non renseignee').toUpperCase(),
      latitude: professional.latitude,
      longitude: professional.longitude,
      imageUrl: this.absoluteAssetUrl(professional.avatarUrl) || '',
      isOnline: presence ? presence.isOnline : (professional as any).isOnline ?? false,
      modes: modes.length > 0 ? modes : [],
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

      const label = formatter.format(date).replace('.', '').trim();
      labels.push(label.charAt(0).toUpperCase() + label.slice(1));
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

    return publicAssetUrl(value);
  }
}
